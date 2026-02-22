'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ShieldAlert, Globe, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function BlockedPage() {
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionData, setInstitutionData] = useState<{nombre?: string} | null>(null);
  const [studentId, setStudentId] = useState<string>('CARGANDO...');

  useEffect(() => {
    // Verificamos que estamos en el cliente antes de usar localStorage
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('selectedInstitutionId');
      const savedStudent = localStorage.getItem('activeStudentId') || 'SIN ID';
      setInstitutionId(savedId);
      setStudentId(savedStudent);

      if (savedId) {
        const unsub = onSnapshot(doc(db, 'institutions', savedId), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setInstitutionData({ nombre: data.nombre });
          }
        });
        return () => unsub();
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white font-sans p-6 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-red-600 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-orange-600 rounded-full blur-3xl"></div>
      </div>

      <main className="max-w-xl w-full text-center space-y-10 relative z-10">
        <div className="mx-auto w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center border-4 border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <ShieldAlert className="w-20 h-20 text-red-500 animate-pulse" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <AlertTriangle className="text-orange-500 w-5 h-5" />
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] bg-orange-500/10 px-3 py-1 rounded-full">
              Protocolo de Seguridad
            </span>
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none text-white">
            ACCESO <br /> <span className="text-red-500">DENEGADO</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium">
            Este sitio web ha sido restringido por <span className="text-white font-bold">{institutionData?.nombre || 'la institución'}</span> bajo el sistema <span className="font-bold text-white uppercase">EDU ServControlPro</span>.
          </p>
        </div>

        <div className="bg-[#11141d] border border-white/5 p-6 rounded-3xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Globe className="text-slate-600 w-6 h-6" />
            <div className="text-left">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ID ESTACIÓN</p>
              <p className="text-xs font-mono font-bold text-slate-300">{studentId}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ESTADO</p>
            <p className="text-xs font-bold text-red-500 uppercase italic">RESTRINGIDO</p>
          </div>
        </div>
      </main>
    </div>
  );
}