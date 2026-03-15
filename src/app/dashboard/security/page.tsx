'use client';

import React from 'react';
import { SecurityRules } from '@/components/admin/config/SecurityRules';
import ProfesorView from '@/components/dashboard/ProfesorView';
import { useAuth } from '@/hooks/use-auth';

export default function SecurityPage() {
  const { user, userData, loading, isSuperAdmin } = useAuth();

  // Loading state alineado al branding oscuro
  if (loading) return (
    <div className="min-h-screen bg-[#080a0f] flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
      <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.4em] italic">
        Sincronizando EDUControlPro...
      </p>
    </div>
  );

  // Extraemos datos de RTDB vía userData
  const institutoId = userData?.InstitutoId || "SEDE-CENTRAL";
  const userRole = userData?.role?.toLowerCase() || 'profesor';
  const hasAdminPrivileges = isSuperAdmin || userRole === 'director';

  return (
    <div className="p-4 md:p-8 bg-[#080a0f] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">
              {hasAdminPrivileges ? 'Acceso Administrativo' : 'Acceso Docente'}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase text-white tracking-tighter leading-none">
            {hasAdminPrivileges ? (
              <>Security & <span className="text-orange-500">Compliance</span></>
            ) : (
              <>Control de <span className="text-orange-500">Aula</span></>
            )}
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 border-l-2 border-orange-500/30 pl-4">
            {hasAdminPrivileges 
              ? `Protocolos de Sede: ${institutoId} • Nodo Directivo` 
              : `Sede: ${institutoId} • Gestión de Dispositivos EDU`}
          </p>
        </header>
        
        <main className="animate-in fade-in zoom-in-95 duration-700 delay-150">
          {hasAdminPrivileges ? (
            <SecurityRules institutionId={institutoId} />
          ) : (
            <ProfesorView />
          )}
        </main>

        <footer className="mt-20 pt-8 border-t border-white/5">
          <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.5em] text-center">
            EDUControlPro Infrastructure Security Suite • 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
