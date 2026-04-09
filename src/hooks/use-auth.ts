'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Hook de Autenticación Centralizado.
 * Gestiona la dualidad entre 'users' (SuperAdmin), supervisor y 'usuarios' (Personal de Sede).
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
          const email = firebaseUser.email;
          const isSuper = email === 'vallecondo@gmail.com';
          const isSupervisor = email === 'generaextra@gmail.com';
          
          if (isSuper || isSupervisor) {
            data = {
              role: isSuper ? 'super-admin' : 'director-supervisor',
              email: email,
              nombre: isSuper ? 'Administrador General' : 'Director Supervisor National',
              InstitutoId: null
            };
          } else {
            // Usuarios estándar en Firestore
            const docRef = doc(db, "usuarios", firebaseUser.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              data = docSnap.data();
            }
          }
          
          setUserData(data);
        } catch (error: any) {
          console.error("Error recuperando perfil de usuario:", error);
          
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
    isSuperAdmin: user?.email === 'vallecondo@gmail.com',
    isSupervisor: user?.email === 'generaextra@gmail.com'
  };
};