'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  const logoPath = "/logo-efas.png"; 

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      {/* Contenedor Circular con Efecto de Radar de Seguridad */}
      <div className="relative flex items-center justify-center">
        {/* Anillos de estado activo */}
        <div className="absolute h-24 w-24 rounded-full border-2 border-orange-500 opacity-20 animate-pulse" />
        <div className="absolute h-28 w-28 rounded-full border border-orange-500/5 animate-[ping_3s_linear_infinite]" />
        
        <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-slate-800 bg-[#0a0c10] flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.15)]">
          <Image 
            src={logoPath} 
            alt="EDUControlPro Logo" 
            width={64}
            height={64}
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Identidad EDUControlPro */}
      <div className="text-center">
        <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">
          EDU<span className="text-orange-500">Control</span>Pro
        </h1>
        <div className="flex flex-col mt-1">
          <p className="text-orange-500 text-[8px] font-black tracking-[0.3em] uppercase italic">
            Security & Monitoring System
          </p>
          <p className="text-slate-600 text-[7px] font-bold tracking-widest uppercase mt-0.5">
            Infraestructura de Control Escolar
          </p>
        </div>
      </div>
    </div>
  );
}
