'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  const logoPath = "/logo-efas.png"; 

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      {/* Contenedor Circular */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full border-2 border-[#f97316] opacity-20 animate-pulse" />
        <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-slate-700 bg-[#0f172a] flex items-center justify-center shadow-2xl">
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

      {/* Identidad Unificada */}
      <div className="text-center">
        <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">
          EDUControlPro
        </h1>
        <p className="text-[#f97316] text-[9px] font-bold tracking-[0.1em] uppercase mt-1">
          SISTEMA DE MONITOREO Y CONTROL PARENTAL
        </p>
      </div>
    </div>
  );
}
