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

// Inicialización segura
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

// Tipos de modo de conexión
export type DbMode = 'cloud' | 'local' | 'hybrid';

// Funciones de configuración
export const getDbMode = (): DbMode => {
  if (typeof window !== "undefined") {
    return (localStorage.getItem("edu_db_mode") as DbMode) || "cloud";
  }
  return "cloud";
};

export const getLocalServerUrl = (): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("edu_local_url") || "http://localhost:5000";
  }
  return "http://localhost:5000";
};

export const setDbMode = (mode: DbMode, localUrl?: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("edu_db_mode", mode);
    if (localUrl) {
      localStorage.setItem("edu_local_url", localUrl);
    }
  }
};

// Cliente API para servidor propio
export const createApiClient = (baseUrl: string) => {
  return {
    // Dispositivos
    getDispositivos: async () => {
      const res = await fetch(`${baseUrl}/api/dispositivos`);
      return res.json();
    },
    getDispositivo: async (id: string) => {
      const res = await fetch(`${baseUrl}/api/dispositivos/${id}`);
      return res.json();
    },
    updateDispositivo: async (id: string, data: any) => {
      const res = await fetch(`${baseUrl}/api/dispositivos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    
    // Usuarios
    getUsuarios: async () => {
      const res = await fetch(`${baseUrl}/api/usuarios`);
      return res.json();
    },
    
    // Alertas
    getAlertas: async () => {
      const res = await fetch(`${baseUrl}/api/alertas`);
      return res.json();
    },
    
    // Web History
    getWebHistory: async (deviceId: string) => {
      const res = await fetch(`${baseUrl}/api/web-history/${deviceId}`);
      return res.json();
    }
  };
};

// Exportamos Firestore como "db" por compatibilidad
export const db = firestore;
export { auth, storage, app };