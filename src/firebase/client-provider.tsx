'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeFirebase } from './index';

export const FirebaseContext = createContext<any>(undefined);

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    try {
      const initializedServices = initializeFirebase() as any;
      if (initializedServices) {
        setServices({
          ...initializedServices,
          areServicesAvailable: !!(initializedServices.auth && (initializedServices.db || initializedServices.firestore))
        });
      }
    } catch (error) {
      console.error("Error EFAS Init:", error);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f172a] gap-6 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#f97316] border-t-transparent" />
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            EFAS <span className="text-[#f97316]">ServiControlPro</span>
          </h2>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
            Cargando Protocolo de Seguridad
          </p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={services}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseClientProvider');
  }
  return context;
};
