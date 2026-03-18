'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white p-6 selection:bg-orange-500/30">
      {/* Glow de fondo para profundidad */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative flex flex-col items-center text-center space-y-6 max-w-sm">
        {/* Icono de Alerta de Seguridad */}
        <div className="bg-orange-500/10 p-6 rounded-[2.5rem] border border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)] mb-4">
          <ShieldAlert size={60} className="text-orange-500 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
            404 <span className="text-orange-500 text-2xl block mt-2">Error de Ruta</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] italic">
            Zona fuera del protocolo de seguridad
          </p>
        </div>

        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />

        <p className="text-slate-400 text-sm font-medium leading-relaxed">
          La ubicación solicitada no existe o ha sido restringida por el sistema central <span className="text-white font-bold italic uppercase text-xs">Shield</span>.
        </p>

        <Link 
          href="/"
          className="group flex items-center gap-3 bg-white/5 hover:bg-orange-600 border border-white/5 hover:border-orange-500 px-8 py-4 rounded-2xl transition-all active:scale-95 shadow-xl"
        >
          <ArrowLeft size={18} className="text-orange-500 group-hover:text-white transition-colors" />
          <span className="text-[10px] font-black uppercase italic tracking-widest group-hover:text-white">
            Regresar al Terminal
          </span>
        </Link>
      </div>

      {/* Marca de agua técnica inferior */}
      <div className="absolute bottom-10 flex flex-col items-center opacity-20">
        <p className="text-[8px] font-black uppercase tracking-[0.8em] text-slate-500">
          EFAS SERVICONTROLPRO
        </p>
      </div>
    </div>
  );
}
