'use client';
import { db } from '@/firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Suscribe la aplicación al PIN maestro de seguridad.
 * @returns Función de desuscripción.
 */
export const subscribeToMasterKey = (callback: (key: string) => void) => {
  const securityDoc = doc(db, 'system_config', 'security');
  
  return onSnapshot(
    securityDoc, 
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.master_pin) {
          callback(String(data.master_pin));
          console.log("🔐 Seguridad: PIN maestro sincronizado.");
        }
      }
    }, 
    (error) => {
      if (error.code === 'permission-denied') {
        // 🔥 CORRECCIÓN: Cambiamos 'listen' por 'read' para cumplir con el tipo SecurityRuleContext
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'system_config/security',
          operation: 'read' 
        }));
      }
      console.error("❌ Error en suscripción de seguridad:", error);
    }
  );
};
