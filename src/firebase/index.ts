import { auth, db, storage } from './config';
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

export { auth, db, storage };

/**
 * Función Logout optimizada para EFAS ServiControlPro
 * Realiza una limpieza profunda para evitar el "doble login" y roles fantasma.
 */
export const logout = async () => {
  try {
    // 1. Cerramos sesión en Auth
    await firebaseSignOut(auth);
    
    // 2. Limpiamos Firestore para que no queden datos en caché de otro rol
    await terminate(db);
    await clearIndexedDbPersistence(db);
    
    // 3. Limpiamos storage local
    localStorage.clear();
    sessionStorage.clear();

    // 4. Redirección limpia
    window.location.replace('/login');
  } catch (error) {
    console.error("Error al cerrar sesión profundo:", error);
    window.location.href = '/login';
  }
};

export { firebaseSignOut as signOut };

// Hooks de Autenticación
export const useUser = () => {
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error };
};

export const useAuth = () => {
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error, auth };
};

export const useFirestore = () => db;

// Hook para documentos individuales
export const useDocument = useFBDocument;
export const useDoc = useFBDocument; 

// Hook de Colección Flexible
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

// --- Funciones CRUD Estándar para EFAS ServiControlPro ---

export const addDocumentNonBlocking = async (path: string, data: any) => {
  try {
    if (!path || typeof path !== 'string' || path.includes('undefined') || path.includes('null')) {
        return { success: false, error: "Ruta de base de datos no válida" };
    }
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
    await updateDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp()
      });
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
export const initializeFirebase = () => ({ auth, db, storage, firestore: db });
