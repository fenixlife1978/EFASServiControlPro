import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicialización segura: si ya existe una app, úsala; si no, inicialízala.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Tus funciones de lógica local se mantienen igual
export const getDbMode = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("edu_db_mode") || "cloud"; 
  }
  return "cloud";
};

export const getLocalServerUrl = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("edu_local_url") || "http://localhost:5000";
  }
  return "http://localhost:5000";
};

export { db, auth, storage, app };