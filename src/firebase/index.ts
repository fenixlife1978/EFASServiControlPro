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

  // Validate that the config is populated, providing a clear error if not.
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase API Key is missing. Check your environment variables (e.g., .env.local).');
  }

  const firebaseApp = initializeApp(firebaseConfig);
  return getSdks(firebaseApp);
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
