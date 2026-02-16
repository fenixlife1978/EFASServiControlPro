'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, db } from '@/firebase'; // Cambiado useFirestore por db
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type InstitutionContextType = {
  institutionId: string | null;
  institutionData: any | null;
  setInstitutionId: (id: string | null) => void; // Añadida función para actualizar
};

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export const InstitutionProvider = ({ children }: { children: ReactNode }) => {
  const [institutionId, setInstitutionIdState] = useState<string | null>(null);
  const [institutionData, setInstitutionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useUser();

  // Función para establecer la institución desde fuera (como el botón Gestionar)
  const updateInstitution = (id: string | null) => {
    if (id) {
      localStorage.setItem('selectedInstitutionId', id);
    } else {
      localStorage.removeItem('selectedInstitutionId');
    }
    setInstitutionIdState(id);
  };

  useEffect(() => {
    const fetchInstitutionId = async () => {
      if (userLoading || !db) return;
      
      setLoading(true);
      setError(null);

      if (!user) {
        setLoading(false);
        return;
      }

      // Prioridad de ID: 1. URL Params, 2. LocalStorage (botón Gestionar), 3. User Document
      const idFromParams = searchParams.get('institutionId');
      const idFromStorage = localStorage.getItem('selectedInstitutionId');
      const isSuperAdmin = user.email === 'vallecondo@gmail.com';

      try {
        let targetId = idFromParams || idFromStorage;

        if (!isSuperAdmin && !targetId) {
          // Si no es super admin, buscamos su institución asignada en su perfil
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().institutionId) {
            targetId = userDoc.data().institutionId;
          } else {
            setError('Tu cuenta no está asociada a ninguna institución.');
            setLoading(false);
            return;
          }
        }

        if (!targetId) {
          setError(isSuperAdmin ? 'Por favor, selecciona una institución desde el Panel Maestro.' : 'No se pudo determinar la institución.');
          setLoading(false);
          return;
        }

        // Buscamos por el ID del documento o el campo InstitutoId
        // Primero intentamos acceso directo por ID de documento (Ruta: /institutions/CMG-002)
        const docRef = doc(db, 'institutions', targetId);
        const docSnap = await getDoc(docRef);

        let data = null;

        if (docSnap.exists()) {
          data = docSnap.data();
        } else {
          // Si no existe como ID de documento, buscamos por el campo InstitutoId
          const instQuery = query(
            collection(db, 'institutions'), 
            where('InstitutoId', '==', targetId) 
          );
          const querySnapshot = await getDocs(instQuery);
          
          if (!querySnapshot.empty) {
            data = querySnapshot.docs[0].data();
          }
        }

        if (data) {
          // Verificación de estado de publicación (Solo Super Admin ignora esto)
          if (data.status === 'published' || isSuperAdmin) {
            setInstitutionIdState(targetId);
            setInstitutionData(data);
          } else {
            setError('Esta institución no se encuentra publicada actualmente.');
          }
        } else {
          setError(`Error: La institución "${targetId}" no existe en EFAS Cloud.`);
        }

      } catch (e) {
        console.error("Error en InstitutionProvider:", e);
        setError('Error de conexión con la base de datos.');
      } finally {
        setLoading(false);
      }
    };

    fetchInstitutionId();
  }, [searchParams, user, userLoading]);

  if (loading || userLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <p className="mt-4 text-slate-400 font-bold tracking-widest uppercase italic">EFAS ServiControlPro</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0c10] p-6">
        <Alert variant="destructive" className="max-w-md bg-slate-900 border-red-900/50 rounded-2xl p-8">
          <Terminal className="h-5 w-5 text-red-500 mb-2" />
          <AlertTitle className="text-red-500 font-black uppercase tracking-tighter text-xl italic">Acceso Denegado</AlertTitle>
          <AlertDescription className="text-slate-300 font-medium">
            <p className="mt-2">{error}</p>
            {user?.email === 'vallecondo@gmail.com' && (
              <div className="mt-8">
                <Button asChild className="bg-orange-600 hover:bg-orange-700 w-full font-black italic uppercase py-6 rounded-xl shadow-lg shadow-orange-900/20">
                  <Link href="/super-admin/dashboard">Ir al Panel Maestro</Link>
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <InstitutionContext.Provider value={{ 
      institutionId, 
      institutionData, 
      setInstitutionId: updateInstitution 
    }}>
      {children}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => {
  const context = useContext(InstitutionContext);
  if (context === undefined) throw new Error('useInstitution debe usarse dentro de un InstitutionProvider');
  return context;
};
