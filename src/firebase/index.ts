'use client';

import { firebaseConfig } from './config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Re-export firebaseConfig
export * from './config';

// Initialize Firebase app, creating it if it doesn't exist.
export function initializeFirebase() {
  if (getApps().length > 0) {
    return getSdks(getApp());
  }

  // VALIDACIÓN CRÍTICA: Si no hay API Key, devolvemos un objeto vacío 
  // para que el Provider no intente inicializar Auth/Firestore todavía.
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "undefined") {
    console.warn("⚠ Firebase: Esperando configuración válida de API Key...");
    return { firebaseApp: null, auth: null, firestore: null } as any;
  }

  try {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  } catch (e) {
    console.error("Error al inicializar Firebase:", e);
    return { firebaseApp: null, auth: null, firestore: null } as any;
  }
}

// Helper to get SDK instances from a FirebaseApp instance.
export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

// Export hooks and providers for easy access throughout the app.
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
export * from './non-blocking-updates';
export * from './non-blocking-login';
