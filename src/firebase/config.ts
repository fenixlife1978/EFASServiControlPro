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
  // IMPORTANTE: Se añade databaseURL para evitar errores de conexión en RTDB
  databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
};

// Inicialización Singleton segura
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const realtimeDb = getDatabase(app); 

// Tipos de modo de conexión para el ecosistema
export type DbMode = 'cloud' | 'local' | 'hybrid';

// ====================================================
// FUNCIONES DE CONFIGURACIÓN Y PERSISTENCIA LOCAL
// ====================================

/**
 * Obtiene el modo de base de datos actual desde el almacenamiento local.
 * Por defecto retorna 'hybrid' si no hay configuración previa.
 */
export const getDbMode = (): DbMode => {
  if (typeof window !== "undefined") {
    const config = localStorage.getItem('app_config');
    if (config) {
      try {
        const { mode } = JSON.parse(config);
        return (mode as DbMode) || "hybrid";
      } catch (e) {
        return "hybrid";
      }
    }
  }
  return "hybrid";
};

/**
 * Obtiene la URL del servidor local de la sede.
 */
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

/**
 * Actualiza la configuración de conexión globalmente.
 */
export const setDbMode = (mode: DbMode, localUrl?: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem('app_config', JSON.stringify({ mode, url: localUrl }));
  }
};

// ====================================================
// API CLIENT PARA MODO LOCAL/HÍBRIDO
// ====================================================

/**
 * Crea un cliente de API para interactuar con el servidor local de la sede.
 * Útil para funciones que no pueden esperar a la sincronización de Firebase.
 */
export const createApiClient = (baseUrl: string) => {
  const fetchOptions = {
    headers: { 'Content-Type': 'application/json' }
  };

  return {
    getDispositivos: async () => {
      const res = await fetch(`${baseUrl}/api/dispositivos`);
      return res.json();
    },
    updateDispositivo: async (id: string, data: any) => {
      const res = await fetch(`${baseUrl}/api/dispositivos/${id}`, {
        method: 'PUT',
        ...fetchOptions,
        body: JSON.stringify(data)
      });
      return res.json();
    },
    getWebHistory: async (deviceId: string) => {
      const res = await fetch(`${baseUrl}/api/web-history/${deviceId}`);
      return res.json();
    },
    // Envía un comando de bloqueo instantáneo al servidor local
    sendInstantCommand: async (deviceId: string, command: string) => {
      const res = await fetch(`${baseUrl}/api/commands`, {
        method: 'POST',
        ...fetchOptions,
        body: JSON.stringify({ deviceId, command })
      });
      return res.json();
    }
  };
};

// ====================================================
// EXPORTACIONES UNIFICADAS
// ====================================================

export const db = firestore;      // Firestore (Estructura de datos pesada)
export const rtdb = realtimeDb;   // Realtime Database (Señales de control en vivo)
export { auth, storage, app };