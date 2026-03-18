'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, rtdb } from '@/firebase/config'; 
import { ref, get, child } from 'firebase/database';

interface InstitutionContextType {
  institutionId: string | null;
  setInstitutionId: (id: string | null) => void;
  userRole: string | null;
  loadingPermissions: boolean;
}

const InstitutionContext = createContext<InstitutionContextType>({
  institutionId: null,
  setInstitutionId: () => {},
  userRole: null,
  loadingPermissions: true
});

export const InstitutionProvider = ({ children }: { children: ReactNode }) => {
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  useEffect(() => {
    const checkUserPermissions = async (user: any) => {
      if (!user) {
        setLoadingPermissions(false);
        return;
      }

      // 1. Lógica de Super-admin (Acceso Global)
      if (user.email === 'vallecondo@gmail.com') {
        setUserRole('super-admin');
        setInstitutionId(null);
        setLoadingPermissions(false);
        return;
      }

      // 2. Consulta Directa a RTDB por UID (Alta velocidad)
      try {
        const dbRef = ref(rtdb);
        const snapshot = await get(child(dbRef, `usuarios/${user.uid}`));

        if (snapshot.exists()) {
          const data = snapshot.val();
          // Mantenemos InstitutoId y role tal cual están en tu DB
          setUserRole(data.role || null);
          setInstitutionId(data.InstitutoId || null);
        } else {
          console.warn("Aviso: El UID del usuario no existe en el nodo 'usuarios' de RTDB");
          setUserRole(null);
          setInstitutionId(null);
        }
      } catch (error) {
        console.error("Error crítico de permisos en RTDB:", error);
        setUserRole(null);
        setInstitutionId(null);
      } finally {
        setLoadingPermissions(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setLoadingPermissions(true);
      if (!user) {
        setUserRole(null);
        setInstitutionId(null);
        setLoadingPermissions(false);
      } else {
        checkUserPermissions(user);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <InstitutionContext.Provider value={{ 
      institutionId, 
      setInstitutionId, 
      userRole, 
      loadingPermissions 
    }}>
      {!loadingPermissions ? children : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="font-black italic uppercase text-slate-300 text-xl tracking-tighter">
               Validando <span className="text-orange-400">EDU</span>ControlPro...
            </div>
            <div className="h-1 w-32 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 animate-progress origin-left w-full"></div>
            </div>
          </div>
        </div>
      )}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => useContext(InstitutionContext);
