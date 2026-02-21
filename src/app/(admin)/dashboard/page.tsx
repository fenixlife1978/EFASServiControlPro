'use client';
import { useEffect, useState } from 'react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import InstitutionView from '@/components/dashboard/InstitutionView';
import SuperAdminView from '@/components/dashboard/SuperAdminView';
import DirectorView from '@/components/dashboard/DirectorView';
import { ProfesorView } from '@/components/dashboard/ProfesorView';
import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { institutionId } = useInstitution();
  const { user, userData } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    setRole(savedRole);
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. LÓGICA SUPER ADMIN
  if (role === 'super-admin') {
    if (institutionId) return <main><InstitutionView /></main>;
    return <main><SuperAdminView /></main>;
  }

  // 2. LÓGICA DIRECTOR
  if (role === 'director') return <main><DirectorView /></main>;

  // 3. LÓGICA PROFESOR (Nueva)
  if (role === 'profesor') {
    return (
      <main>
        <ProfesorView 
          professorId={user?.uid || ''} 
          institutoId={userData?.InstitutoId || 'default'} 
        />
      </main>
    );
  }

  // Fallback de seguridad por defecto
  return <main><InstitutionView /></main>;
}
