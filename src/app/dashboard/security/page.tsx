'use client';

import React from 'react';
import { SecurityRules } from '@/components/admin/config/SecurityRules';
import { ProfesorView } from '@/components/dashboard/ProfesorView';
import { useAuth } from '@/hooks/use-auth';

export default function SecurityPage() {
  const { user, userData, loading, isSuperAdmin } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
    </div>
  );

  // Corregido: Extraemos de userData para evitar el error de TS
  const institutoId = userData?.InstitutoId || "SEDE-DEFAULT";
  const userRole = userData?.role?.toLowerCase() || 'profesor';
  const hasAdminPrivileges = isSuperAdmin || userRole === 'director';

  return (
    <div className="p-8 bg-[#080a0f] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-black italic uppercase text-white tracking-tighter">
            {hasAdminPrivileges ? 'Security & Compliance' : 'Control de Aula'}
          </h1>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.3em] mt-2">
            {hasAdminPrivileges 
              ? `Protocolos de Sede: ${institutoId} • Nivel Directivo` 
              : `Sede: ${institutoId} • Gestión de Dispositivos EFAS`}
          </p>
        </header>
        
        {hasAdminPrivileges ? (
          <SecurityRules institutionId={institutoId} />
        ) : (
          <ProfesorView 
            professorId={user?.uid || ''} 
            institutoId={institutoId} 
          />
        )}
      </div>
    </div>
  );
}
