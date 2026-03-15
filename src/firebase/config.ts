import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database"; 

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // Si tu base de datos no está en la región de US-Central, 
  // podrías necesitar agregar: databaseURL: "TU_URL_DE_RTDB_AQUI"
};

// Inicialización segura
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const realtimeDb = getDatabase(app); 

// Tipos de modo de conexión
export type DbMode = 'cloud' | 'local' | 'hybrid';

// ====================================================
// FUNCIONES DE CONFIGURACIÓN LOCAL
// ====================================================

export const getDbMode = (): DbMode => {
  if (typeof window !== "undefined") {
    const config = localStorage.getItem('app_config');
    if (config) {
      try {
        const { mode } = JSON.parse(config);
        return (mode as DbMode) || "cloud";
      } catch (e) {
        return "cloud";
      }
    }
  }
  return "cloud";
};

export const getLocalServerUrl = (): string => {
  if (typeof window !== "undefined") {
    const config = localStorage.getItem('app_config');
    if (config) {
      try {
        const { url } = JSON.parse(config);
        return url || "http://localhost:5000";
      } catch (e) {
        return "http://localhost:5000";
      }
    }
  }
  return "http://localhost:5000";
};

export const setDbMode = (mode: DbMode, localUrl?: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem('app_config', JSON.stringify({ mode, url: localUrl }));
  }
};

// ====================================================
// API CLIENT PARA MODO LOCAL/HÍBRIDO
// ====================================================

export const createApiClient = (baseUrl: string) => {
  return {
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
    getUsuarios: async () => {
      const res = await fetch(`${baseUrl}/api/usuarios`);
      return res.json();
    },
    getAlertas: async () => {
      const res = await fetch(`${baseUrl}/api/alertas`);
      return res.json();
    },
    getWebHistory: async (deviceId: string) => {
      const res = await fetch(`${baseUrl}/api/web-history/${deviceId}`);
      return res.json();
    }
  };
};

// ====================================================
// EXPORTACIONES UNIFICADAS
// ====================================================

export const db = firestore;     // Firestore (usuarios, instituciones)
export const rtdb = realtimeDb;   // Realtime Database (dispositivos, señales)
export { auth, storage, app };