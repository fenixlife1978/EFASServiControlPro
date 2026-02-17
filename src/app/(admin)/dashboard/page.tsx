'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { IncidentsTable } from '@/components/admin/security/IncidentsTable';
import { DirectMessage } from '@/components/admin/messaging/DirectMessage';
import { SecurityRules } from '@/components/admin/config/SecurityRules';
import { WhitelistRules } from '@/components/admin/config/WhitelistRules';
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { 
  ShieldCheck, 
  Activity, 
  LayoutDashboard, 
  Users, 
  Settings2, 
  Zap, 
  School,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function DashboardPage() {
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  // Corrección: Usamos 'nombre' en lugar de 'name' para coincidir con tu Firebase
  const [institutionData, setInstitutionData] = useState<{nombre?: string, logoUrl?: string} | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('selectedInstitutionId');
    setInstitutionId(savedId);

    if (savedId) {
      // Escucha en tiempo real de los datos del Instituto (colección institutions)
      const unsub = onSnapshot(doc(db, 'institutions', savedId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setInstitutionData({
            nombre: data.nombre, // Mapeo correcto del campo 'nombre'
            logoUrl: data.logoUrl
          });
        }
      });
      return () => unsub();
    }
  }, []);

  if (!institutionId) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-orange-500 font-black italic animate-pulse uppercase tracking-widest text-sm">
            Sin institución seleccionada
          </p>
          <Link href="/institutions" className="text-slate-500 text-[10px] underline font-black uppercase tracking-[0.2em] hover:text-white transition-colors">
            Volver a Selección de Institución
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white py-4 font-sans">
      <main className="max-w-[1550px] mx-auto space-y-8">
        
        {/* HEADER DE IDENTIDAD INSTITUCIONAL */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-white/5 pb-10 gap-8">
          <div className="flex items-center gap-8">
            {/* Contenedor de Logo Premium */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-tr from-orange-600 to-blue-600 rounded-[2.2rem] blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative w-24 h-24 bg-[#11141d] rounded-[2rem] border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl">
                {institutionData?.logoUrl ? (
                  <Image 
                    src={institutionData.logoUrl} 
                    alt="Logo Institucional" 
                    fill 
                    className="object-contain p-3"
                  />
                ) : (
                  <School className="w-10 h-10 text-slate-700" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-[1px] w-8 bg-orange-500/50"></div>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] italic">
                  Centro de Mando Estructural
                </span>
              </div>
              
              {/* Nombre del Colegio con tipografía elegante y corregida */}
              <h1 className="text-5xl lg:text-6xl font-black italic uppercase tracking-tighter leading-none text-white py-1">
                {institutionData?.nombre || 'CARGANDO...'}
              </h1>

              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                  <LayoutDashboard className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                    ID: {institutionId}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-emerald-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">En Línea</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href="/dashboard/classrooms">
              <button className="bg-white/5 hover:bg-white/10 border border-white/10 px-8 py-5 rounded-2xl flex items-center gap-3 transition-all group active:scale-95 shadow-xl border-b-2 border-b-orange-600/50">
                <Users className="w-5 h-5 text-orange-500 group-hover:rotate-12 transition-transform" />
                <span className="text-[12px] font-black uppercase italic tracking-tight text-slate-200">
                  Panel de Aulas
                </span>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </header>

        {/* STATUS BAR RÁPIDA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#11141d] border border-white/5 rounded-2xl p-6 flex items-center gap-4 hover:border-orange-500/20 transition-all cursor-default">
            <div className="bg-emerald-500/10 p-4 rounded-2xl">
              <Activity className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Frecuencia de Red</p>
              <p className="text-base font-bold text-white uppercase italic tracking-tighter">Estable / 1ms</p>
            </div>
          </div>
          
          <div className="bg-[#11141d] border border-white/5 rounded-2xl p-6 flex items-center gap-4 lg:col-span-3">
            <div className="bg-orange-500/10 p-4 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Resumen de Seguridad</p>
              <p className="text-xs font-bold text-slate-400 uppercase italic leading-tight">
                El sistema <span className="text-white font-black">EFAS ServControlPro</span> está operando bajo la licencia de <span className="text-orange-500">{institutionData?.nombre || institutionId}</span>.
              </p>
            </div>
          </div>
        </div>

        {/* ÁREA OPERATIVA: INCIDENCIAS Y MENSAJERÍA */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-8">
            <IncidentsTable institutionId={institutionId} />
          </div>
          <div className="xl:col-span-4">
            <DirectMessage institutionId={institutionId} />
          </div>
        </div>

        {/* SECCIÓN DE CONFIGURACIÓN Y REGLAS */}
        <div className="space-y-6 pt-10 border-t border-white/5">
          <div className="flex items-center gap-3 px-2">
            <Settings2 className="text-slate-600 w-5 h-5" />
            <h3 className="text-sm font-black uppercase italic text-slate-500 tracking-[0.2em]">
              Protocolos de Seguridad y Filtrado
            </h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
            <SecurityRules institutionId={institutionId} />
            <WhitelistRules institutionId={institutionId} />
            <GlobalControls institutionId={institutionId} />
          </div>
        </div>

      </main>

      <footer className="mt-10 py-10 border-t border-white/5 text-center">
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.6em]">
          EFAS ServControlPro • {institutionData?.nombre || 'Sistema de Control'} • 2026
        </p>
      </footer>
    </div>
  );
}
