import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 1. Invocamos las llaves desde tus variables de entorno (Protegidas)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 2. Función para detectar si el usuario eligió Local o Nube
export const getDbMode = () => {
  if (typeof window !== "undefined") {
    // Si no hay nada guardado, por defecto usamos la nube (Firebase)
    return localStorage.getItem("edu_db_mode") || "cloud"; 
  }
  return "cloud";
};

// 3. Función para obtener la dirección del Servidor de la Escuela
export const getLocalServerUrl = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("edu_local_url") || "http://localhost:5000";
  }
  return "http://localhost:5000";
};

// Inicializamos Firebase (seguirá funcionando para el Login siempre)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { db, auth };