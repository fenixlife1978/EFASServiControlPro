'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Hook de Autenticación Centralizado.
 * Gestiona la dualidad entre 'users' (SuperAdmin) y 'usuarios' (Personal de Sede).
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        let data = null;

        try {
          // DETERMINAR COLECCIÓN SEGÚN PRIVILEGIOS
          const isSuper = firebaseUser.email === 'vallecondo@gmail.com';
          const collectionName = isSuper ? "users" : "usuarios";
          
          const docRef = doc(db, collectionName, firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            data = docSnap.data();
            // Inyectamos el rol explícitamente si es super-admin
            if (isSuper) data.role = 'super-admin';
          } else if (isSuper) {
            // Fallback para el primer login del Super Admin
            data = { 
              role: 'super-admin',
              email: firebaseUser.email,
              nombre: 'Administrador General'
            };
          }
          
          setUserData(data);
        } catch (error: any) {
          console.error("Error recuperando perfil de usuario:", error);
          
          // Si el error es de permisos, notificamos al sistema híbrido
          if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: `perfiles/${firebaseUser.uid}`,
              operation: 'get'
            }));
          }
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { 
    user, 
    userData, 
    loading, 
    // Flag de utilidad para vistas rápidas
    isSuperAdmin: user?.email === 'vallecondo@gmail.com' 
  };
};