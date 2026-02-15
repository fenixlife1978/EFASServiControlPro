import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const directConfig = {
  apiKey: "AIzaSyACK79dDRclgjFMEUokqpskC1ezyvmO11k",
  authDomain: "studio-7637044995-2342d.firebaseapp.com",
  projectId: "studio-7637044995-2342d",
  storageBucket: "studio-7637044995-2342d.firebasestorage.app",
  messagingSenderId: "7637044995",
  appId: "1:7637044995:web:2c6b412952864386927958"
};

// Inicialización única
const app = getApps().length > 0 ? getApp() : initializeApp(directConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function initializeFirebase() {
  return {
    firebaseApp: app,
    auth: auth,
    firestore: db
  };
}

// Re-exportamos los hooks y el provider
export * from './config';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
