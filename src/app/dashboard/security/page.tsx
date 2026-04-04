'use client';

import React from 'react';
import { SecurityAnalytics } from '@/components/admin/config/SecurityAnalytics';
import ProfesorView from '@/components/dashboard/ProfesorView';
import { useAuth } from '@/hooks/use-auth';
import { Shield, ShieldCheck, UserCog } from 'lucide-react';

export default function SecurityPage() {
  const { user, userData, loading, isSuperAdmin } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-[#080a0f] flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
      <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.4em] italic">
        Sincronizando EDUControlPro...
      </p>
    </div>
  );

  // Validar que el usuario tiene acceso
  if (!user) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-white font-black uppercase">Acceso no autorizado</p>
          <p className="text-slate-500 text-xs mt-2">Inicia sesión para continuar</p>
        </div>
      </div>
    );
  }

  const institutoId = userData?.InstitutoId || "SEDE-CENTRAL";
  const userRole = userData?.role?.toLowerCase() || 'profesor';
  
  // Determinar si tiene privilegios de administración (SuperAdmin o Director)
  const hasAdminPrivileges = isSuperAdmin || userRole === 'director' || userRole === 'super-admin';
  
  // Determinar el rol visual para mostrar
  const getRoleIcon = () => {
    if (isSuperAdmin) return <UserCog className="w-4 h-4 text-purple-500" />;
    if (userRole === 'director') return <ShieldCheck className="w-4 h-4 text-orange-500" />;
    return <Shield className="w-4 h-4 text-blue-500" />;
  };
  
  const getRoleLabel = () => {
    if (isSuperAdmin) return 'SUPER ADMIN';
    if (userRole === 'director') return 'DIRECTOR';
    return 'DOCENTE';
  };

  return (
    <div className="p-4 md:p-8 bg-[#080a0f] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] flex items-center gap-2">
              {getRoleIcon()}
              {getRoleLabel()}
            </span>
            <span className="text-[8px] text-slate-600">|</span>
            <span className="text-[8px] text-slate-500 uppercase tracking-wider">
              {institutoId}
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
              ? `Protocolos de Sede: ${institutoId} • ${isSuperAdmin ? 'Super Administración' : 'Nodo Directivo'}` 
              : `Sede: ${institutoId} • Gestión de Dispositivos EDU`}
          </p>
        </header>
        
        <main className="animate-in fade-in zoom-in-95 duration-700 delay-150">
          {hasAdminPrivileges ? (
            // SecurityAnalytics no acepta props, usa su propio contexto
            <SecurityAnalytics />
          ) : (
            // ProfesorView no acepta props, usa su propio contexto
            <ProfesorView />
          )}
        </main>

        <footer className="mt-20 pt-8 border-t border-white/5">
          <div className="flex justify-between items-center">
            <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.5em]">
              EDUControlPro Infrastructure Security Suite • 2026
            </p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[7px] text-slate-600 font-mono">
                {hasAdminPrivileges ? 'Admin Mode' : 'Student Mode'} • Shield Active
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
