'use client';
import React from 'react';
import UserManagement from '@/components/admin/users/UserManagement';
import { Users } from 'lucide-react';

export default function UsersPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase text-slate-900 tracking-tighter">
            Panel de <span className="text-orange-500">Personal</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">
            Configuración de Directores y Profesores • EDUControlPro
          </p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border-2 border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black uppercase italic text-slate-600 tracking-widest">
            Super Admin Mode
          </span>
        </div>
      </header>

      <main className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* IMPORTANTE: La lógica de migración de Firestore a RTDB para la creación 
            y listado de usuarios debe realizarse dentro de <UserManagement />
        */}
        <UserManagement />
      </main>

      <footer className="pt-10 border-t border-slate-100">
        <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.3em] text-center">
          Gestión de Credenciales Seguras • EDUControlPro Sistema de Control Parental
        </p>
      </footer>
    </div>
  );
}
