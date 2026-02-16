'use client';

import React from 'react';
import { SecurityAlertListener } from '@/components/student/SecurityAlertListener';
import { ShieldAlert, Lock, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BlockedPage() {
  // Estos datos vendrían de la sesión del alumno en el dispositivo
  const institutionId = typeof window !== 'undefined' ? localStorage.getItem('activeInstitutoId') : '';
  const studentId = typeof window !== 'undefined' ? localStorage.getItem('activeStudentId') : '';

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
      {/* El "Oído" de seguridad: Si el director manda mensaje, se activa sobre esta pantalla */}
      <SecurityAlertListener institutionId={institutionId || ''} studentId={studentId || ''} />

      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="flex justify-center relative">
          <div className="absolute inset-0 bg-red-600/20 blur-[100px] rounded-full" />
          <div className="relative bg-red-600/10 border border-red-600/20 p-8 rounded-[3rem]">
            <ShieldAlert className="w-24 h-24 text-red-600 animate-pulse" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-black italic tracking-tighter uppercase">
            CONTENIDO <span className="text-red-600">RESTRINGIDO</span>
          </h1>
          <div className="flex items-center justify-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-xs">
            <Lock className="w-4 h-4" /> Filtro de Seguridad EFAS ServiControlPro Activo
          </div>
        </div>

        <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-2xl">
          <p className="text-slate-400 text-lg leading-relaxed">
            Has intentado acceder a una dirección web no autorizada por la institución. 
            Esta actividad ha sido <span className="text-white font-bold">reportada automáticamente</span> al panel del Director.
          </p>
        </div>

        <div className="pt-4 flex flex-col gap-4 items-center">
            <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">
                Su IP y Usuario han sido registrados
            </p>
            <Button 
                onClick={() => window.location.href = '/'}
                className="bg-white hover:bg-slate-200 text-black font-black italic rounded-2xl px-10 py-6 uppercase transition-all"
            >
                <Home className="w-5 h-5 mr-2" /> Volver al Inicio
            </Button>
        </div>
      </div>
    </div>
  );
}