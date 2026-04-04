import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      
      const dbUrl = process.env.FIREBASE_DATABASE_URL || 
                    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 
                    `https://studio-7637044995-2342d-default-rtdb.firebaseio.com/`;
      
      console.log('📡 Firebase Database URL:', dbUrl);

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: dbUrl
      });
      
      console.log("✅ Firebase Admin Inicializado");
    } else {
      admin.initializeApp();
    }
  } catch (error) {
    console.error('❌ Firebase Admin Init Error:', error);
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;

export const adminRtdb = {
  get database() {
    if (!admin.apps.length) return null;
    try {
      return admin.database();
    } catch (error) {
      console.error('❌ Error obteniendo RTDB:', error);
      return null;
    }
  },
  ref(path?: string) {
    if (!admin.apps.length) {
      return {
        once: () => Promise.resolve({ exists: () => false, val: () => ({}) }),
        child: () => this.ref(),
        remove: () => Promise.resolve(),
        set: () => Promise.resolve(),
        push: () => ({ set: () => Promise.resolve(), key: 'mock_key' })
      } as any;
    }
    return admin.database().ref(path);
  }
} as any;