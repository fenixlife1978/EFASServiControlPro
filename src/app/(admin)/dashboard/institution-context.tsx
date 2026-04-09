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

      const email = user.email;

      // ============================================================
      // SUPER ADMIN & DIRECTOR SUPERVISOR - ACCESO ABSOLUTO
      // ============================================================
      if (email === 'vallecondo@gmail.com') {
        setUserRole('super-admin');
        setInstitutionId(null);
        setLoadingPermissions(false);
        return;
      }

      if (email === 'generaextra@gmail.com') {
        setUserRole('director-supervisor');
        setInstitutionId(null);
        setLoadingPermissions(false);
        return;
      }

      // Consulta a RTDB para personal de sede
      try {
        const dbRef = ref(rtdb);
        const snapshot = await get(child(dbRef, `usuarios/${user.uid}`));

        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserRole(data.role || null);
          setInstitutionId(data.InstitutoId || null);
        } else {
          // Si es un acceso absoluto mockeado que no está en la DB
          const savedRole = localStorage.getItem('userRole');
          if (savedRole && localStorage.getItem('absoluteAccess') === 'true') {
            setUserRole(savedRole);
            setInstitutionId(null);
          }
        }
      } catch (error) {
        console.error("Error de permisos:", error);
      } finally {
        setLoadingPermissions(false);
      }
    };

    // Usar un listener manual que soporte el mock
    const checkAuth = () => {
      setLoadingPermissions(true);
      const unsub = auth.onAuthStateChanged((user) => {
        if (user) {
          checkUserPermissions(user);
        } else {
          // Comprobar si hay sesión absoluta simulada
          const isAbsolute = localStorage.getItem('absoluteAccess') === 'true';
          const mockEmail = localStorage.getItem('userEmail');
          if (isAbsolute && mockEmail) {
            checkUserPermissions({ email: mockEmail, uid: 'absolute_' + mockEmail.split('@')[0] });
          } else {
            setUserRole(null);
            setInstitutionId(null);
            setLoadingPermissions(false);
          }
        }
      });
      return unsub;
    };

    const unsubscribe = checkAuth();
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
          </div>
        </div>
      )}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => useContext(InstitutionContext);