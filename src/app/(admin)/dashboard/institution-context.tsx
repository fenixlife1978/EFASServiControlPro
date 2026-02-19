'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/firebase/config';
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

      if (user.email === 'vallecondo@gmail.com') {
        setUserRole('super-admin');
        return;
      }

      const q = query(collection(db, "usuarios"), where("email", "==", user.email));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setUserRole(data.role);
        setInstitutionId(data.InstitutoId); 
      }
    };

    const unsub = auth.onAuthStateChanged(() => checkUserPermissions());
    return () => unsub();
  }, []);

  return (
    <InstitutionContext.Provider value={{ institutionId, setInstitutionId, userRole }}>
      {children}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => useContext(InstitutionContext);
