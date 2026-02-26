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

export default function DashboardPage() {
  const { institutionId } = useInstitution();
  const { user, userData } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'monitor' | 'seguridad'>('monitor');
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

  // 2. LÓGICA DIRECTOR (Con Sistema de Pestañas)
  if (role === 'director') {
    const workingInstId = userData?.InstitutoId || localStorage.getItem('InstitutoId') || '';
    
    return (
      <main className="min-h-screen bg-[#0a0c10] p-6 lg:p-10">
        <div className="flex gap-2 mb-8 bg-slate-900/40 p-1.5 rounded-2xl border border-slate-800 w-fit">
          <button 
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all ${activeTab === 'monitor' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-white'}`}
          >
            <LayoutDashboard size={14} /> Monitor Live
          </button>
          <button 
            onClick={() => setActiveTab('seguridad')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all ${activeTab === 'seguridad' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-500 hover:text-white'}`}
          >
            <ShieldAlert size={14} /> Seguridad
          </button>
        </div>

        {activeTab === 'monitor' ? (
          <DirectorView />
        ) : (
          <IncidentsTable institutionId={workingInstId} />
        )}
      </main>
    );
  }

  // 3. LÓGICA PROFESOR (Corregido sin props)
  if (role === 'profesor') {
    return (
      <main className="p-6 lg:p-10">
        <ProfesorView />
      </main>
    );
  }

  return <main><InstitutionView /></main>;
}
