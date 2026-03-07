'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/firebase';  // Ajusta según tu estructura real
import { collection, query, where, getDocs } from 'firebase/firestore';

interface InstitutionContextType {
  institutionId: string | null;
  setInstitutionId: (id: string | null) => void;
  userRole: string | null;
}

const InstitutionContext = createContext<InstitutionContextType>({
  institutionId: null,
  setInstitutionId: () => {},
  userRole: null
});

export const InstitutionProvider = ({ children }: { children: ReactNode }) => {
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkUserPermissions = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Super-admin
      if (user.email === 'vallecondo@gmail.com') {
        setUserRole('super-admin');
        setInstitutionId(null);  // Super-admin no tiene sede fija
        return;
      }

      // Buscar en colección 'usuarios'
      try {
        const q = query(collection(db, "usuarios"), where("email", "==", user.email));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setUserRole(data.role);
          setInstitutionId(data.InstitutoId || null);
        } else {
          console.warn("Usuario no encontrado en 'usuarios'");
          setUserRole(null);
          setInstitutionId(null);
        }
      } catch (error) {
        console.error("Error verificando permisos:", error);
        setUserRole(null);
        setInstitutionId(null);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        // Limpiar al cerrar sesión
        setUserRole(null);
        setInstitutionId(null);
      }
      checkUserPermissions();
    });

    return () => unsubscribe();
  }, []);

  return (
    <InstitutionContext.Provider value={{ institutionId, setInstitutionId, userRole }}>
      {children}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => useContext(InstitutionContext);
