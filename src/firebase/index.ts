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
  CollectionReference 
} from 'firebase/firestore';
import { signOut as firebaseSignOut } from 'firebase/auth';

export { auth, db, storage };

/**
 * Función Logout optimizada para EFAS ServiControlPro
 * Limpia el estado local y cierra la sesión en Firebase.
 */
export const logout = async () => {
  try {
    await firebaseSignOut(auth);
    // Limpiamos el ID de institución seleccionada y cualquier otra basura del storage
    localStorage.removeItem('selectedInstitutionId');
    // Forzamos redirección al login
    window.location.href = '/login';
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
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

// Hook de Colección Flexible (Corregido para evitar Error 2353 de TypeScript)
export const useCollection = (pathOrQuery: string | Query | CollectionReference) => {
    const isInvalidPath = typeof pathOrQuery === 'string' && 
        (!pathOrQuery || pathOrQuery.includes('undefined') || pathOrQuery.includes('null'));

    if (isInvalidPath) {
        return { value: [], loading: false, error: new Error("Ruta de colección inválida") };
    }

    const ref = typeof pathOrQuery === 'string' ? collection(db, pathOrQuery) : pathOrQuery;
    
    // Eliminamos idField para cumplir con los tipos de la librería
    const [snapshot, loading, error] = useCollectionData(ref as any);
    
    // Mapeo manual para inyectar el ID en cada objeto
    const value = snapshot ? snapshot.map((data: any) => ({
        ...data,
        id: data.id || '' 
    })) : [];

    return { value, loading, error };
};

// --- Funciones CRUD Estándar para EFAS ServiControlPro ---

export const addDocumentNonBlocking = async (path: string, data: any) => {
  try {
    if (!path || typeof path !== 'string' || path.includes('undefined') || path.includes('null')) {
        console.error("Path inválido detectado:", path);
        return { success: false, error: "Ruta de base de datos no válida" };
    }

    const docRef = await addDoc(collection(db, path), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error addDocument:", error);
    return { success: false, error: error.message };
  }
};

export const updateDocumentNonBlocking = async (collectionName: string, id: string, data: any) => {
  try {
    if (!collectionName || !id) throw new Error("Colección o ID faltante");

    await updateDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    return { success: true };
  } catch (error: any) {
    console.error("Error updateDocument:", error);
    return { success: false, error: error.message };
  }
};

export const deleteDocumentNonBlocking = async (collectionName: string, id: string) => {
  try {
    if (!collectionName || !id) throw new Error("Colección o ID faltante");

    await deleteDoc(doc(db, collectionName, id));
    return { success: true };
  } catch (error: any) {
    console.error("Error deleteDocument:", error);
    return { success: false, error: error.message };
  }
};

