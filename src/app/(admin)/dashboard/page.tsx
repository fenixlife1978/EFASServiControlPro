'use client';
import { useEffect, useState } from 'react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import InstitutionView from '@/components/dashboard/InstitutionView';
import SuperAdminView from '@/components/dashboard/SuperAdminView';
import DirectorView from '@/components/dashboard/DirectorView';
import ProfesorView from '@/components/dashboard/ProfesorView';
import { useAuth } from '@/hooks/use-auth';

// CORRECCIÓN DE RUTA: Importación desde la ubicación específica indicada
import { SecurityLogsTable } from '@/components/admin/config/SecurityLogsTable';

interface UserDataType {
  InstitutoId?: string;
  role?: string;
  nombre?: string;
  email?: string;
}

export default function DashboardPage() {
  const { institutionId } = useInstitution();
  const { user, userData } = useAuth() as { user: any; userData: UserDataType | null };
  const [role, setRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (userData?.role) {
      setRole(userData.role);
      localStorage.setItem('userRole', userData.role);
    } 
    else {
      const savedRole = localStorage.getItem('userRole');
      if (savedRole) {
        setRole(savedRole);
      }
    }
    setIsMounted(true);
  }, [userData]);

  useEffect(() => {
    if (user?.email === 'vallecondo@gmail.com') {
      setRole('super-admin');
      localStorage.setItem('userRole', 'super-admin');
    }
  }, [user]);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center gap-6">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-2 border-orange-500/10 border-t-orange-500 rounded-full animate-spin"></div>
          <div className="absolute w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] italic animate-pulse">
            Sincronizando <span className="text-orange-500">Nodos</span>
          </p>
          <p className="text-slate-700 text-[8px] font-bold uppercase tracking-widest">
            EDUControlPro Security Infrastructure
          </p>
        </div>
      </div>
    );
  }

  // VISTA SUPER ADMIN
  if (role === 'super-admin' || user?.email === 'vallecondo@gmail.com') {
    if (institutionId) {
      return (
        <main className="min-h-screen bg-[#0a0c10] animate-in fade-in duration-500">
          <InstitutionView />
          <div className="p-6 lg:p-10 max-w-7xl mx-auto">
            <SecurityLogsTable institutionId={institutionId} />
          </div>
        </main>
      );
    }
    return (
      <main className="min-h-screen bg-[#0a0c10] animate-in slide-in-from-bottom-4 duration-700">
        <SuperAdminView />
      </main>
    );
  }

  // VISTA DIRECTOR
  if (role === 'director') {
    return (
      <main className="min-h-screen bg-[#0a0c10] p-6 lg:p-10 animate-in fade-in duration-500">
        <DirectorView />
        {userData?.InstitutoId && (
          <div className="mt-8">
            <SecurityLogsTable institutionId={userData.InstitutoId} />
          </div>
        )}
      </main>
    );
  }

  // VISTA PROFESOR
  if (role === 'profesor') {
    return (
      <main className="min-h-screen bg-[#0a0c10] p-6 lg:p-10 animate-in fade-in duration-500">
        <ProfesorView />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-500/5 border border-red-500/10 p-10 rounded-[3rem] max-w-sm">
        <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
          Sin Permisos de Acceso
        </p>
        <p className="text-slate-500 text-xs font-bold leading-relaxed">
          Tu cuenta no tiene un rol asignado en la base de datos de EDUControlPro.
        </p>
      </div>
    </main>
  );
}
