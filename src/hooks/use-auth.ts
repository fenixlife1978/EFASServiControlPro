'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      let activeUser = firebaseUser;
      
      // Fallback para Acceso Absoluto (Supervisor/Admin)
      if (!activeUser && typeof window !== 'undefined') {
        const isAbsolute = localStorage.getItem('absoluteAccess') === 'true';
        const mockEmail = localStorage.getItem('userEmail');
        if (isAbsolute && mockEmail) {
          activeUser = { 
            email: mockEmail, 
            uid: 'absolute_' + mockEmail.split('@')[0],
            displayName: mockEmail === 'vallecondo@gmail.com' ? 'Super Admin' : 'Director Supervisor'
          } as any;
        }
      }
      
      if (activeUser) {
        setUser(activeUser);
        let data = null;

        try {
          const email = activeUser.email;
          const isSuper = email === 'vallecondo@gmail.com';
          const isSupervisor = email === 'generaextra@gmail.com';
          
          if (isSuper || isSupervisor) {
            data = {
              role: isSuper ? 'super-admin' : 'director-supervisor',
              email: email,
              nombre: isSuper ? 'Administrador General' : 'Director Supervisor',
              InstitutoId: null
            };
          } else {
            const docRef = doc(db, "usuarios", activeUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) data = docSnap.data();
          }
          
          setUserData(data);
        } catch (error: any) {
          console.error("Error recuperando perfil:", error);
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