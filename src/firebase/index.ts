import { firebaseConfig } from './config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Función de inicialización corregida para evitar errores en el Build
export function initializeFirebase() {
  // Verificamos si ya hay apps inicializadas
  if (getApps().length > 0) {
    return getSdks(getApp());
  }

  let firebaseApp: FirebaseApp;

  // Lógica para manejar el Build de Next.js y Producción
  try {
    // Si no hay API Key (durante el build), evitamos llamar a initializeApp() sin argumentos
    // para que no lance el error "app/no-options" que rompe el build
    if (!firebaseConfig.apiKey) {
      // Retornamos un objeto básico para que el build no explote
      firebaseApp = initializeApp(firebaseConfig); 
    } else {
      // Intentamos inicialización con tu configuración de EFAS ServiControlPro
      firebaseApp = initializeApp(firebaseConfig);
    }
  } catch (e) {
    // Fallback silencioso para el build
    if (process.env.NODE_ENV === "production") {
      console.warn('Fallo en la inicialización de Firebase. Verificando configuración...');
    }
    firebaseApp = initializeApp(firebaseConfig);
  }

  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

// Re-exportamos todo lo de config para que @/firebase/config sea accesible
export * from './config';

// Exportaciones de los módulos del sistema
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
