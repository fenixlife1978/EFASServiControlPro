'use client';

import React, { useEffect, useState } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { ShieldAlert, Globe, AlertTriangle } from 'lucide-react';

export default function BlockedPage() {
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionData, setInstitutionData] = useState<{nombre?: string} | null>(null);
  const [studentId, setStudentId] = useState<string>('CARGANDO...');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('selectedInstitutionId');
      const savedStudent = localStorage.getItem('activeStudentId') || 'SIN ID';
      setInstitutionId(savedId);
      setStudentId(savedStudent);

      if (savedId) {
        // Migrado a RTDB para respuesta instantánea en la tablet
        const instRef = ref(rtdb, `institutions/${savedId}`);
        
        onValue(instRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setInstitutionData({ nombre: data.nombre });
          }
        });

        return () => off(instRef);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white font-sans p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-red-600 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-orange-600 rounded-full blur-[120px]"></div>
      </div>

      <main className="max-w-xl w-full text-center space-y-10 relative z-10">
        {/* Shield Icon */}
        <div className="mx-auto w-32 h-32 bg-red-500/10 rounded-[2.5rem] flex items-center justify-center border-4 border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.3)] rotate-3">
          <ShieldAlert className="w-20 h-20 text-red-500 animate-pulse -rotate-3" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <AlertTriangle className="text-orange-500 w-4 h-4" />
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] bg-orange-500/10 px-4 py-1.5 rounded-full border border-orange-500/20">
              Protocolo de Seguridad Activo
            </span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-black italic uppercase tracking-tighter leading-none text-white">
            ACCESO <br /> <span className="text-red-600">DENEGADO</span>
          </h1>
          
          <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium leading-relaxed">
            Este dominio ha sido restringido por <span className="text-white font-bold">{institutionData?.nombre || 'la institución'}</span> bajo el entorno de seguridad <span className="font-black text-orange-500 uppercase italic">EDUControlPro</span>.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-[#11141d]/80 backdrop-blur-xl border border-white/5 p-7 rounded-[2.5rem] flex items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800/50 p-3 rounded-2xl">
              <Globe className="text-slate-400 w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estación de Trabajo</p>
              <p className="text-sm font-mono font-bold text-orange-100">{studentId}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estado Firewall</p>
            <p className="text-xs font-black text-red-500 uppercase italic tracking-tighter">FILTRADO POR IP</p>
          </div>
        </div>

        <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.6em]">
          EDUControlPro • 2026
        </p>
      </main>
    </div>
  );
}