'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

      const idFromParams = searchParams.get('institutionId');
      const isSuperAdmin = user.email === 'vallecondo@gmail.com';

      try {
        let targetId = idFromParams;

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
          setError(isSuperAdmin ? 'Selecciona una institución desde el Panel Maestro.' : 'No se encontró el ID.');
          setLoading(false);
          return;
        }

        // CAMBIO CLAVE: Buscamos por "InstitutoId" en la colección "institutions"
        const instQuery = query(
          collection(firestore, 'institutions'), 
          where('InstitutoId', '==', targetId)
        );
        
        const querySnapshot = await getDocs(instQuery);

        if (!querySnapshot.empty) {
          const instDoc = querySnapshot.docs[0];
          const data = instDoc.data();

          // Validación de estado de publicación [cite: 2026-01-29]
          if (data.status === 'published' || isSuperAdmin) {
            setInstitutionId(targetId);
            setInstitutionData(data);
          } else {
            setError('Acceso denegado: Esta institución no está publicada.');
          }
        } else {
          setError('El ID de institución no existe en el sistema.');
        }

      } catch (e) {
        console.error("Error:", e);
        setError('Error al verificar la institución.');
      } finally {
        setLoading(false);
      }
    };

    fetchInstitutionId();
  }, [searchParams, user, userLoading, firestore]);

  if (loading || userLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <p className="mt-4 text-slate-400">Cargando EFAS ServiControlPro...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 p-6">
        <Alert variant="destructive" className="max-w-md bg-slate-900 border-red-900/50">
          <Terminal className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-500 font-bold">Error de Acceso</AlertTitle>
          <AlertDescription>
            <p className="mt-2">{error}</p>
            {user?.email === 'vallecondo@gmail.com' && (
              <div className="mt-6">
                <Button asChild className="bg-orange-600 hover:bg-orange-700 w-full">
                  <Link href="/super-admin">Ir al Panel Maestro</Link>
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
  if (context === undefined) throw new Error('useInstitution debe usarse dentro de InstitutionProvider');
  return context;
};