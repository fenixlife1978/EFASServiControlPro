import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { useAuthState } from "react-firebase-hooks/auth";
// Importación explícita
import { useCollection as useFBCollection, useDocument as useFBDocument } from "react-firebase-hooks/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const useUser = () => {
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error };
};

export const logout = async () => await signOut(auth);

// Exportación garantizada de los hooks
export const useCollection = useFBCollection;
export const useDocument = useFBDocument;
export const useDoc = useFBDocument; // Alias para compatibilidad

export default app;
