'use client';

import React, { useEffect, useState } from 'react';
import { IncidentsTable } from '@/components/admin/security/IncidentsTable';
import { DirectMessage } from '@/components/admin/messaging/DirectMessage';
import { ShieldCheck, Activity, LayoutDashboard, Users } from 'lucide-react';
import Link from 'next/link';
import { SecurityRules } from '@/components/admin/config/SecurityRules';

export default function DashboardPage() {
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => {
    // Obtenemos el ID de la institución seleccionada
    const savedId = localStorage.getItem('selectedInstitutionId');
    setInstitutionId(savedId);
  }, []);

  if (!institutionId) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-orange-500 font-black italic animate-pulse uppercase tracking-widest">
            Sin institución seleccionada
          </p>
          <Link href="/institutions" className="text-slate-500 text-xs underline font-bold uppercase">
            Volver a Selección
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-6 font-sans">
      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* Header de Gestión */}
        <header className="flex justify-between items-end border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="text-orange-500 w-5 h-5" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Centro de Operaciones</span>
            </div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">
              DASHBOARD <span className="text-orange-500 text-2xl ml-2">v2.0</span>
            </h1>
          </div>

          <div className="flex gap-4">
            <Link href="/dashboard/classrooms">
              <button className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3 transition-all">
                <Users className="w-4 h-4 text-orange-500" />
                <span className="text-[11px] font-black uppercase italic">Ver Aulas</span>
              </button>
            </Link>
          </div>
        </header>

        {/* Status Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#11141d] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3 rounded-xl">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estado Global</p>
              <p className="text-sm font-bold text-white uppercase italic">Sincronizado</p>
            </div>
          </div>
          
          <div className="bg-[#11141d] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-orange-500/10 p-3 rounded-xl">
              <LayoutDashboard className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ID Institución</p>
              <p className="text-sm font-bold text-orange-500 font-mono uppercase">{institutionId}</p>
            </div>
          </div>
        </div>

        {/* MÓDULOS PRINCIPALES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Columna Izquierda: Seguridad */}
          <div className="space-y-6">
            <IncidentsTable institutionId={institutionId} />
          </div>

          {/* Columna Derecha: Mensajería */}
          <div className="space-y-6">
            <DirectMessage institutionId={institutionId} />
            <SecurityRules institutionId={institutionId} />
          </div>
        </div>

      </main>
    </div>
  );
}
