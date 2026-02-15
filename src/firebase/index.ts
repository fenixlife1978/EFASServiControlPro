import { auth, db, storage } from './config';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// Exportamos auth directamente para asegurar que mantenga sus prototipos
export { auth, db, storage };

// 1. Hooks de Autenticación
export const useAuth = () => {
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error, auth };
};

export const useUser = () => {
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error };
};

// 2. Hook para obtener la instancia de Firestore
export const useFirestore = () => db;

// 3. Hook para Colecciones
export const useCollection = (pathOrQuery: any) => {
    const [value, loading, error] = useCollectionData(pathOrQuery, {
        idField: 'id'
    });
    return { value: value || [], loading, error };
};

// 4. Funciones de Utilidad Operativas
export const addDocumentNonBlocking = async (collectionName: string, data: any) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    return { success: true, id: docRef.id };
  } catch (error) { return { success: false, error }; }
};

export const updateDocumentNonBlocking = async (collectionName: string, id: string, data: any) => {
  try {
    await updateDoc(doc(db, collectionName, id), data);
    return { success: true };
  } catch (error) { return { success: false, error }; }
};

export const deleteDocumentNonBlocking = async (collectionName: string, id: string) => {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return { success: true };
  } catch (error) { return { success: false, error }; }
};
