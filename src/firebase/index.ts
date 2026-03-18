'use client';

import { auth, db, storage, rtdb } from './config';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  useCollectionData, 
  useDocument as useFBDocument 
} from 'react-firebase-hooks/firestore';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  Query, 
  CollectionReference,
  terminate,
  clearIndexedDbPersistence
} from 'firebase/firestore';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Re-exportamos los servicios base
export { auth, db, storage, rtdb };

/**
 * Función Logout Atómica
 * Realiza una limpieza profunda de caché y estados locales.
 */
export const logout = async () => {
  try {
    // 1. Cerramos sesión en Auth
    await firebaseSignOut(auth);
    
    // 2. Limpiamos Firestore para evitar persistencia de datos de otros roles
    await terminate(db);
    await clearIndexedDbPersistence(db);
    
    // 3. Limpieza total de almacenamiento
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      
      // 4. Redirección forzada
      window.location.replace('/login');
    }
  } catch (error) {
    console.error("Error en cierre de sesión profundo:", error);
    window.location.href = '/login';
  }
};

export { firebaseSignOut as signOut };

// --- HOOKS DE AUTENTICACIÓN ---

export const useUser = () => {
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error };
};

export const useAuth = () => {
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error, auth };
};

// --- HOOKS DE FIRESTORE ---

export const useFirestore = () => db;
export const useDocument = useFBDocument;
export const useDoc = useFBDocument; 

/**
 * Hook de Colección Flexible con validación de rutas
 */
export const useCollection = (pathOrQuery: string | Query | CollectionReference) => {
    const isInvalidPath = typeof pathOrQuery === 'string' && 
        (!pathOrQuery || pathOrQuery.includes('undefined') || pathOrQuery.includes('null'));

    if (isInvalidPath) {
        return { value: [], loading: false, error: new Error("Ruta de colección inválida") };
    }

    const ref = typeof pathOrQuery === 'string' ? collection(db, pathOrQuery) : pathOrQuery;
    const [value, loading, error] = useCollectionData(ref as any);

    return { value: value || [], loading, error };
};

// --- FUNCIONES CRUD CON PROPAGACIÓN DE ERRORES ---

export const addDocumentNonBlocking = async (path: string, data: any) => {
  try {
    if (!path || typeof path !== 'string' || path.includes('undefined') || path.includes('null')) {
        return { success: false, error: "Ruta no válida" };
    }
    const docRef = await addDoc(collection(db, path), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'create' }));
    }
    return { success: false, error: error.message };
  }
};

export const updateDocumentNonBlocking = async (collectionName: string, id: string, data: any) => {
  try {
    const path = `${collectionName}/${id}`;
    await updateDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    return { success: true };
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: `${collectionName}/${id}`, 
        operation: 'update' 
      }));
    }
    return { success: false, error: error.message };
  }
};

export const deleteDocumentNonBlocking = async (collectionName: string, id: string) => {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return { success: true };
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: `${collectionName}/${id}`, 
        operation: 'delete' 
      }));
    }
    return { success: false, error: error.message };
  }
};


export const initializeFirebase = () => ({ auth, db, storage, rtdb, firestore: db });