'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type InstitutionContextType = {
  institutionId: string | null;
};

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export const InstitutionProvider = ({ children }: { children: ReactNode }) => {
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const fetchInstitutionId = async () => {
      setLoading(true);
      setError(null);
      const idFromParams = searchParams.get('institutionId');

      if (userLoading) {
        return; // Wait until user loading is complete
      }
      
      if (!user || !firestore) {
        setLoading(false);
        // If not logged in, they will be redirected by the layout, so we just wait.
        return;
      }

      const isSuperAdmin = user.uid === 'QeGMDNE4GaSJOU8XEnY3lFJ9by13';

      // Case 1: Super admin can view any institution specified in the URL.
      if (isSuperAdmin) {
        if (idFromParams) {
          setInstitutionId(idFromParams);
        } else {
          // Super admin must specify which institution to manage when at /dashboard.
          setError('No se ha especificado una institución.');
        }
        setLoading(false);
        return;
      }

      // Case 2: Regular admin user. We must verify their permissions.
      try {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().institutionId) {
          const assignedInstitutionId = userDocSnap.data().institutionId;

          // If a specific institution is requested in the URL...
          if (idFromParams) {
            // ...it MUST match the admin's assigned institution.
            if (idFromParams !== assignedInstitutionId) {
              router.push('/dashboard/unauthorized');
              // Don't set loading to false; the redirect will unmount this.
              return; 
            }
          }
          
          // If we reach here, the access is valid. Set the institution ID to the one they are assigned.
          // This covers both cases: URL param matches, or no URL param was provided.
          setInstitutionId(assignedInstitutionId);

        } else {
          setError('Tu cuenta de administrador no está asociada a ninguna institución.');
        }
      } catch (e) {
        console.error("Error fetching user's institution:", e);
        setError('No se pudo verificar la información de tu institución.');
      }
      
      setLoading(false);
    };

    fetchInstitutionId();
  }, [searchParams, user, userLoading, firestore, router]);

  if (loading || userLoading) {
    return (
        <div className="flex h-64 w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }
  
  if (error || !institutionId) {
      return (
          <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Acceso Denegado</AlertTitle>
              <AlertDescription>
                {error || 'No se pudo determinar la institución a gestionar.'}
                {user?.uid === 'QeGMDNE4GaSJOU8XEnY3lFJ9by13' && (
                    <div className="mt-4">
                        <Button asChild>
                            <Link href="/super-admin">
                                Ir al Panel Maestro
                            </Link>
                        </Button>
                    </div>
                )}
              </AlertDescription>
          </Alert>
      )
  }

  return (
    <InstitutionContext.Provider value={{ institutionId }}>
      {children}
    </InstitutionContext.Provider>
  );
};

export const useInstitution = (): InstitutionContextType => {
  const context = useContext(InstitutionContext);
  if (context === undefined) {
    throw new Error('useInstitution must be used within an InstitutionProvider');
  }
  return context;
};
