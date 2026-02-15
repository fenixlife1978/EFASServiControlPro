'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ShieldAlert, LockKeyhole, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MasterLockScreen({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.length < 4) {
      setError(true);
      return;
    }
    onUnlock(key);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      {/* Logo de Marca */}
      <div className="flex flex-col items-center gap-4 mb-12">
        <div className="relative w-24 h-24 rounded-full border-2 border-orange-500/50 bg-[#1e293b] flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.2)]">
          <Image 
            src="/logo-efas.png" 
            alt="EFAS Logo" 
            width={70} 
            height={70} 
            className="object-contain"
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">
            EFAS <span className="text-[#f97316]">ServiControlPro</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Protección de Sistema Activa</p>
        </div>
      </div>

      {/* Caja de Desbloqueo */}
      <div className="w-full max-w-sm bg-slate-900/50 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-6 text-orange-500">
          <ShieldAlert className="w-5 h-5" />
          <h2 className="font-bold text-sm uppercase tracking-wider">Acceso Restringido</h2>
        </div>
        
        <p className="text-slate-400 text-sm mb-6">
          Se requiere la <b>Clave Maestra</b> del administrador para realizar cambios en la configuración o desinstalar la aplicación.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="password"
              value={key}
              onChange={(e) => {setKey(e.target.value); setError(false);}}
              placeholder="Ingrese Clave Maestra"
              className={cn(
                "w-full bg-slate-950 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all",
                error && "border-red-500 animate-shake"
              )}
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-[#f97316] hover:bg-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            Validar y Desbloquear
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>

      <p className="mt-12 text-slate-600 text-[10px] uppercase font-bold tracking-widest">
        Intento reportado a: vallecondo@gmail.com
      </p>
    </div>
  );
}
