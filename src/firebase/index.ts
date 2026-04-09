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
 */
export const logout = async () => {
  try {
    await firebaseSignOut(auth);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userEmail');
      localStorage.removeItem('absoluteAccess');
      localStorage.removeItem('userRole');
      localStorage.removeItem('InstitutoId');
      sessionStorage.clear();
      window.location.replace('/login');
    }
  } catch (error) {
    console.error("Error en cierre de sesión:", error);
    window.location.href = '/login';
  }
};

export { firebaseSignOut as signOut };

// --- HOOKS DE AUTENTICACIÓN ---

export const useUser = () => {
    const [user, loading, error] = useAuthState(auth);
    
    // Fallback para Acceso Absoluto (Supervisor/Admin)
    if (!loading && !user && typeof window !== 'undefined') {
      const isAbsolute = localStorage.getItem('absoluteAccess') === 'true';
      const mockEmail = localStorage.getItem('userEmail');
      if (isAbsolute && mockEmail) {
        return { 
          user: { email: mockEmail, uid: 'absolute_' + mockEmail.split('@')[0] } as any, 
          loading: false, 
          error: null 
        };
      }
    }
    
    return { user, loading, error };
};

export const useAuth = () => {
    const authData = useUser();
    return { ...authData, auth };
};

// --- HOOKS DE FIRESTORE ---

export const useFirestore = () => db;
export const useDocument = useFBDocument;
export const useDoc = useFBDocument; 

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

// --- FUNCIONES CRUD ---

export const addDocumentNonBlocking = async (path: string, data: any) => {
  try {
    const docRef = await addDoc(collection(db, path), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateDocumentNonBlocking = async (collectionName: string, id: string, data: any) => {
  try {
    await updateDoc(doc(db, collectionName, id), { ...data, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deleteDocumentNonBlocking = async (collectionName: string, id: string) => {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const initializeFirebase = () => ({ auth, db, storage, rtdb, firestore: db });