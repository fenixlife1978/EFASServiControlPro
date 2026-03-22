import * as admin from 'firebase-admin';

// Initialize Firebase Admin if it hasn't been initialized already
if (!admin.apps.length) {
  try {
    // Intenta usar las variables de entorno para Vercel
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Reemplaza los saltos de línea literales por carácteres de salto reales
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`
      });
    } else {
      // Intenta usar de forma predeterminada (útil si usas GOOGLE_APPLICATION_CREDENTIALS o en GCP)
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
export const adminRtdb = admin.apps.length ? admin.database() : null;
