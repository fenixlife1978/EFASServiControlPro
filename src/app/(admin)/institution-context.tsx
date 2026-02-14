'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type InstitutionContextType = {
  institutionId: string | null;
  institutionData: any | null;
};

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export const InstitutionProvider = ({ children }: { children: ReactNode }) => {
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionData, setInstitutionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const fetchInstitutionId = async () => {
      if (userLoading || !firestore) return;
      
      setLoading(true);
      setError(null);

      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Obtenemos el ID de la URL (?institutionId=CAG-001)
      const idFromParams = searchParams.get('institutionId');
      const isSuperAdmin = user.email === 'vallecondo@gmail.com';

      try {
        let targetId = idFromParams;

        // Si no es Super Admin, usamos el ID que tenga asignado en su documento de usuario
        if (!isSuperAdmin) {
          const userDoc = await getDoc(doc(firestore, 'users', user.uid));
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

        // 2. BUSQUEDA CRÍTICA: Filtramos por el campo exacto "InstitutoId"
        const instQuery = query(
          collection(firestore, 'institutions'), 
          where('InstitutoId', '==', targetId) 
        );
        
        const querySnapshot = await getDocs(instQuery);

        if (!querySnapshot.empty) {
          const instDoc = querySnapshot.docs[0];
          const data = instDoc.data();

          // 3. Verificamos publicación (Super Admin tiene bypass) [cite: 2026-01-29]
          if (data.status === 'published' || isSuperAdmin) {
            setInstitutionId(targetId);
            setInstitutionData(data);
          } else {
            setError('Esta institución no se encuentra publicada actualmente.');
          }
        } else {
          // Si llegamos aquí, el InstitutoId enviado no existe en Firestore
          setError(`Error: La institución con ID "${targetId}" no fue encontrada.`);
        }

      } catch (e) {
        console.error("Error en InstitutionProvider:", e);
        setError('Error de conexión con la base de datos.');
      } finally {
        setLoading(false);
      }
    };

    fetchInstitutionId();
  }, [searchParams, user, userLoading, firestore]);

  if (loading || userLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <p className="mt-4 text-slate-400 font-medium tracking-widest">EFAS SERVICONTROLPRO</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 p-6">
        <Alert variant="destructive" className="max-w-md bg-slate-900 border-red-900/50">
          <Terminal className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-500 font-bold uppercase tracking-tighter">Acceso Denegado</AlertTitle>
          <AlertDescription className="text-slate-300">
            <p className="mt-2">{error}</p>
            {user?.email === 'vallecondo@gmail.com' && (
              <div className="mt-6">
                <Button asChild className="bg-orange-600 hover:bg-orange-700 w-full font-bold">
                  <Link href="/super-admin">Volver al Panel Maestro</Link>
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <InstitutionContext.Provider value={{ institutionId, institutionData }}>
      {children}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = () => {
  const context = useContext(InstitutionContext);
  if (context === undefined) throw new Error('useInstitution debe usarse dentro de un InstitutionProvider');
  return context;
};
