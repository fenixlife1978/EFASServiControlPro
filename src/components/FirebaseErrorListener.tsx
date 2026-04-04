'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, RTDBPermissionError } from '@/firebase/errors';

/**
 * Componente invisible que escucha eventos globales de error de permisos.
 * Adaptado para el modelo híbrido de EDUControlPro (Firestore + RTDB).
 */
export function FirebaseErrorListener() {
  // Estado para capturar errores de cualquiera de las dos bases de datos
  const [error, setError] = useState<FirestorePermissionError | RTDBPermissionError | null>(null);

  useEffect(() => {
    // Manejador para errores de Firestore (Documentos, Auditoría, Sedes)
    const handleFirestoreError = (err: FirestorePermissionError) => {
      console.error("🔥 [EDUControlPro] Error de permisos en Firestore:", err);
      setError(err);
    };

    // Manejador para errores de Realtime Database (Comandos, Bloqueos, Alertas)
    const handleRTDBError = (err: RTDBPermissionError) => {
      console.warn("⚡ [EDUControlPro] Error de permisos en Realtime DB:", err);
      setError(err);
    };

    // Suscripción a ambos tipos de eventos en el modelo híbrido
    errorEmitter.on('permission-error', handleFirestoreError);
    errorEmitter.on('rtdb-permission-error', handleRTDBError);

    return () => {
      errorEmitter.off('permission-error', handleFirestoreError);
      errorEmitter.off('rtdb-permission-error', handleRTDBError);
    };
  }, []);

  // Al re-renderizar, si existe un error, lo lanzamos para que lo capture global-error.tsx
  if (error) {
    throw error;
  }

  return null;
}
