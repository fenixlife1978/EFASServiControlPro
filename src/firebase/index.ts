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
export const logout = () => firebaseSignOut(auth);

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

// Hook para documentos individuales (Utilizado en ClassroomDetailPage)
export const useDocument = useFBDocument;
export const useDoc = useFBDocument; // Alias para compatibilidad

// Hook de Colección Flexible (Soporta Queries de Ordenamiento)
export const useCollection = (pathOrQuery: string | Query | CollectionReference) => {
    // Protección contra rutas nulas o indefinidas (Evita error n.indexOf)
    const isInvalidPath = typeof pathOrQuery === 'string' && 
        (!pathOrQuery || pathOrQuery.includes('undefined') || pathOrQuery.includes('null'));

    if (isInvalidPath) {
        return { value: [], loading: false, error: new Error("Ruta de colección inválida") };
    }

    const ref = typeof pathOrQuery === 'string' ? collection(db, pathOrQuery) : pathOrQuery;
    
    // CORRECCIÓN TS: Eliminamos idField de las opciones para evitar el Error 2353
    const [snapshot, loading, error] = useCollectionData(ref as any);
    
    // Mapeo manual para asegurar que cada objeto tenga su propiedad 'id'
    const value = snapshot ? snapshot.map((data: any) => ({
        ...data,
        id: data.id || '' // Mantiene compatibilidad con el resto de la app
    })) : [];

    return { value, loading, error };
};

// --- Funciones CRUD Estándar para EFAS ServiControlPro ---

/**
 * Agrega un documento validando que el path sea una cadena válida.
 * Evita el error "n.indexOf is not a function" de Firebase.
 */
export const addDocumentNonBlocking = async (path: string, data: any) => {
  try {
    // Validación crítica de ruta antes de llamar a Firebase
    if (!path || typeof path !== 'string' || path.includes('undefined') || path.includes('null')) {
        console.error("Path inválido detectado en addDocumentNonBlocking:", path);
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

export { firebaseSignOut as signOut };