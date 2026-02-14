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
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const fetchInstitutionId = async () => {
      // Evitamos ejecutar si aún está cargando el usuario o Firebase no está listo
      if (userLoading || !firestore) return;
      
      setLoading(true);
      setError(null);
      

      // Si no hay usuario, el middleware o el layout deberían manejar la redirección,
      // pero aquí detenemos la carga.
      if (!user) {
        setLoading(false);
        return;
      }

      const idFromParams = searchParams.get('institutionId');
      const isSuperAdmin = user.email === 'vallecondo@gmail.com';

      try {
        let targetId = idFromParams;

        // 1. Lógica de obtención del ID
        if (!isSuperAdmin) {
          // Si es un admin normal, forzamos el ID que tiene asignado en su perfil
          const userDoc = await getDoc(doc(firestore, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().institutionId) {
            targetId = userDoc.data().institutionId;
          } else {
            setError('Tu cuenta de administrador no está asociada a ninguna institución.');
            setLoading(false);
            return;
          }
        }

        // 2. Verificación de existencia del ID
        if (!targetId) {
          setError(isSuperAdmin ? 'Por favor, selecciona una institución desde el Panel Maestro.' : 'No se pudo determinar tu institución.');
          setLoading(false);
          return;
        }

        // 3. Validación en la colección 'instituciones' (Buscamos por condoId)
        const instQuery = query(
          collection(firestore, 'instituciones'), 
          where('condoId', '==', targetId)
        );
        
        const querySnapshot = await getDocs(instQuery);

        if (!querySnapshot.empty) {
          const instDoc = querySnapshot.docs[0];
          const data = instDoc.data();

          // REGLA: Si está despublicado, solo el Super Admin puede entrar a ver/arreglar cosas.
          // Los demás reciben error. [Instrucción 2026-01-29]
          if (data.status === 'published' || isSuperAdmin) {
            setInstitutionId(targetId);
            setInstitutionData(data);
          } else {
            setError('Acceso denegado: Esta institución no se encuentra publicada actualmente.');
          }
        } else {
          setError('La institución con el ID especificado no existe en el sistema.');
        }

      } catch (e) {
        console.error("Error en InstitutionProvider:", e);
        setError('Error crítico al verificar la institución.');
      } finally {
        setLoading(false);
      }
    };

    fetchInstitutionId();
  }, [searchParams, user, userLoading, firestore]);

  // Pantalla de carga estética
  if (loading || userLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <p className="mt-4 text-slate-400 font-medium">EFAS ServiControlPro</p>
      </div>
    );
  }
  
  // Manejo de errores de acceso
  if (error || !institutionId) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 p-6">
        <Alert variant="destructive" className="max-w-md bg-slate-900 border-red-900/50">
          <Terminal className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-500 font-bold">Error de Acceso</AlertTitle>
          <AlertDescription className="text-slate-300">
            <p className="mt-2">{error || 'No se pudo determinar la institución.'}</p>
            {user?.email === 'vallecondo@gmail.com' && (
              <div className="mt-6">
                <Button asChild className="bg-orange-600 hover:bg-orange-700 w-full">
                  <Link href="/super-admin">
                    Ir al Panel Maestro de Instituciones
                  </Link>
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
  if (context === undefined) {
    throw new Error('useInstitution debe ser usado dentro de un InstitutionProvider');
  }
  return context;
};

