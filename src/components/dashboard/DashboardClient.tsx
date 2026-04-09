'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import InstitutionView from '@/components/dashboard/InstitutionView';
import SuperAdminView from '@/components/dashboard/SuperAdminView';
import DirectorView from '@/components/dashboard/DirectorView';
import ProfesorView from '@/components/dashboard/ProfesorView';
import { useAuth } from '@/hooks/use-auth';
import { SecurityLogsTable } from '@/components/admin/config/SecurityLogsTable';
import FilterConfig from '@/components/admin/FilterConfig';

export function DashboardClient() {
  const { institutionId, userRole: roleFromContext } = useInstitution();
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!loading) {
      const currentRole = roleFromContext || userData?.role;
      setRole(currentRole);
      
      // Si es supervisor, llevarlo directo a su panel
      if (currentRole === 'director-supervisor' || currentRole === 'supervisor') {
        router.push('/dashboard/supervisor');
      }
      
      setIsMounted(true);
    }
  }, [userData, roleFromContext, loading, router]);

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
        <p className="text-orange-500 font-black uppercase italic animate-pulse">Validando Credenciales...</p>
      </div>
    );
  }

  // VISTA SUPER ADMIN
  if (role === 'super-admin') {
    if (institutionId) {
      return (
        <main className="min-h-screen bg-[#0a0c10] p-6 space-y-10">
          <InstitutionView />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
            <FilterConfig activeId={institutionId} />
            <SecurityLogsTable institutionId={institutionId} />
          </div>
        </main>
      );
    }
    return <SuperAdminView />;
  }

  // VISTA SUPERVISOR
  if (role === 'director-supervisor' || role === 'supervisor') {
    return null;
  }

  // VISTA DIRECTOR
  if (role === 'director') {
    return (
      <main className="min-h-screen bg-[#0a0c10] p-6 lg:p-10">
        <DirectorView />
        {institutionId && (
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FilterConfig activeId={institutionId} />
            <SecurityLogsTable institutionId={institutionId} />
          </div>
        )}
      </main>
    );
  }

  // VISTA PROFESOR
  if (role === 'profesor') {
    return <ProfesorView />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
      <div className="text-center space-y-4">
        <p className="text-red-500 font-black uppercase italic">Perfil no identificado</p>
        <button onClick={() => window.location.href = '/login'} className="text-[10px] text-slate-500 underline">Volver al Terminal</button>
      </div>
    </div>
  );
}
