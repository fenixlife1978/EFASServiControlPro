'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        let data = null;
        
        // 1. Si es super-admin, buscar en colección "users"
        if (firebaseUser.email === 'vallecondo@gmail.com') {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            data = docSnap.data();
            data.role = 'super-admin'; // Asegurar rol
          } else {
            // Si no existe, crear datos por defecto
            data = { 
              role: 'super-admin',
              email: firebaseUser.email,
              nombre: 'Super Admin'
            };
          }
        } 
        // 2. Para otros roles, buscar en colección "usuarios"
        else {
          const docRef = doc(db, "usuarios", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            data = docSnap.data();
          }
        }
        
        setUserData(data);
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
    isSuperAdmin: user?.email === 'vallecondo@gmail.com' 
  };
};