'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  // Nota: Asegúrate de que la imagen esté en public/logo-efas.png
  // Si no la tienes aún, usará el fallback del círculo azul.
  const logoPath = "/logo-efas.png"; 

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      {/* Contenedor Circular Estilo Protocolo */}
      <div className="relative flex items-center justify-center">
        {/* El anillo brillante exterior */}
        <div className="absolute h-24 w-24 rounded-full border-2 border-[#f97316] opacity-20 animate-pulse" />
        
        {/* El círculo principal del logo */}
        <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-slate-700 bg-[#0f172a] flex items-center justify-center shadow-2xl">
          <Image 
            src={logoPath} 
            alt="EDU Logo Shield" 
            width={64}
            height={64}
            className="object-contain"
            priority
            onError={(e) => {
              // Fallback si la imagen no carga: muestra un escudo genérico
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Nombre de la Marca debajo del círculo */}
      <div className="text-center leading-none">
        <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase">
          EDU
        </h1>
        <p className="text-[#f97316] text-[11px] font-bold tracking-[0.2em] uppercase mt-1">
          ControlPro
        </p>
      </div>
    </div>
  );
}
