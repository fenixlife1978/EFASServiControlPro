'use client';
import { useEffect, useState } from 'react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import InstitutionView from '@/components/dashboard/InstitutionView';
import SuperAdminView from '@/components/dashboard/SuperAdminView';
import DirectorView from '@/components/dashboard/DirectorView';
import ProfesorView from '@/components/dashboard/ProfesorView';
import { IncidentsTable } from '@/components/security/IncidentsTable';
import { useAuth } from '@/hooks/use-auth';
import { LayoutDashboard, ShieldAlert } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'monitor' | 'seguridad'>('monitor');
  const [isMounted, setIsMounted] = useState(false);

  // Obtener rol desde múltiples fuentes
  useEffect(() => {
    // 1. Prioridad: userData de Firebase
    if (userData?.role) {
      console.log('Rol desde userData:', userData.role);
      setRole(userData.role);
    } 
    // 2. Fallback: localStorage
    else {
      const savedRole = localStorage.getItem('userRole');
      if (savedRole) {
        console.log('Rol desde localStorage:', savedRole);
        setRole(savedRole);
      }
    }
    setIsMounted(true);
  }, [userData]);

  // 3. Verificación directa por email (super-admin)
  useEffect(() => {
    if (user?.email === 'vallecondo@gmail.com') {
      console.log('Super-admin detectado por email');
      setRole('super-admin');
      localStorage.setItem('userRole', 'super-admin');
    }
  }, [user]);

  // Cargando
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Cargando panel...</p>
      </div>
    );
  }

  // SUPER ADMIN (por rol o por email)
  if (role === 'super-admin' || user?.email === 'vallecondo@gmail.com') {
    if (institutionId) {
      return (
        <main className="min-h-screen bg-[#0a0c10]">
          <InstitutionView />
        </main>
      );
    }
    return (
      <main className="min-h-screen bg-[#0a0c10]">
        <SuperAdminView />
      </main>
    );
  }

  // DIRECTOR (sin pestaña de seguridad)
  if (role === 'director') {
    const workingInstId = userData?.InstitutoId || institutionId || '';
    
    return (
      <main className="min-h-screen bg-[#0a0c10] p-6 lg:p-10">
        {/* Eliminadas las pestañas de monitor/seguridad */}
        <DirectorView />
      </main>
    );
  }

  // PROFESOR
  if (role === 'profesor') {
    return (
      <main className="min-h-screen bg-[#0a0c10] p-6 lg:p-10">
        <ProfesorView />
      </main>
    );
  }

  // ROL DESCONOCIDO
  return (
    <main className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
        No tienes permisos para acceder
      </p>
    </main>
  );
}
