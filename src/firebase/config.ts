'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
};

// Initialize Firebase
// Add a check for apiKey to prevent crashes
const app = (firebaseConfig.apiKey && firebaseConfig.apiKey !== "undefined")
    ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) 
    : null;

const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

if (!app) {
    console.warn("Firebase config is missing or invalid. Firebase services will not be available.");
}

// Hooks for components to use
export const useFirestore = () => db;
export const useAuth = () => auth;

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { user, loading };
}
