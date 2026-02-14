'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common/logo';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl shadow-slate-200 p-10 text-center border border-slate-100">
        
        {/* Logo de la Marca */}
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        {/* Icono de Alerta */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-orange-100 text-orange-600 mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Mensaje de Error */}
        <h1 className="text-3xl font-black tracking-tighter italic text-slate-900 leading-none">
          ACCESO <span className="text-orange-500">RESTRINGIDO</span>
        </h1>
        
        <p className="mt-4 text-slate-500 font-bold text-sm uppercase tracking-wider leading-relaxed">
          Lo sentimos, no tienes permisos para gestionar esta institución.
        </p>

        <div className="mt-8 space-y-3">
          {/* Botón para volver a la institución propia */}
          <Link href="/dashboard/classrooms" className="block">
            <Button className="w-full bg-blue-950 hover:bg-slate-900 text-white font-black italic uppercase py-6 rounded-2xl gap-2">
              <Home className="w-4 h-4 text-orange-400" />
              Volver a mi Panel
            </Button>
          </Link>

          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-6">
            EFAS ServiControlPro &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
}
