'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
      <div className="text-center space-y-6">
        <div className="text-8xl font-black italic text-slate-800">404</div>
        <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">
          Página No Encontrada
        </h1>
        <p className="text-slate-500 text-sm">
          Lo sentimos, la página que buscas no existe.
        </p>
        <Link 
          href="/dashboard" 
          className="inline-block bg-orange-500 px-6 py-3 rounded-xl text-white font-black uppercase text-xs tracking-wider hover:bg-orange-600 transition-all"
        >
          Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}
