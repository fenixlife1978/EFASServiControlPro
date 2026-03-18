'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useAuth } from '../index';

/**
 * Hook personalizado para gestionar el estado del usuario.
 * Adaptado para el flujo híbrido: una vez detectado el usuario, 
 * el sistema permite la vinculación con los nodos de Realtime Database.
 */
export const useUser = () => {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Si el provider de auth no está listo, esperamos.
    if (!auth || !auth.auth) {
      // No seteamos loading false aquí para evitar saltos visuales 
      // mientras el provider de Firebase se inicializa.
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth.auth,
      (firebaseUser) => {
        if (firebaseUser) {
          // 🔥 LÓGICA HÍBRIDA: 
          // Al detectar usuario, podrías disparar aquí una verificación de 
          // claims personalizados (admin/super-admin) para activar funciones de RTDB.
          setUser(firebaseUser);
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (err) => {
        // Usamos el sistema de logs limpio que establecimos
        console.error('❌ Error de Autenticación:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return { user, loading, error };
};
