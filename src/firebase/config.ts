import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './index';

export const firebaseConfig = {
  apiKey: "AIzaSyACK79dDRclgjFMEUokqpskC1ezyvmO11k",
  authDomain: "studio-7637044995-2342d.firebaseapp.com",
  projectId: "studio-7637044995-2342d",
  storageBucket: "studio-7637044995-2342d.firebasestorage.app",
  messagingSenderId: "7637044995",
  appId: "1:7637044995:web:2c6b412952864386927958"
};

export const useAuth = () => auth;
export const useFirestore = () => db;

export function useUser() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { user, loading };
}
