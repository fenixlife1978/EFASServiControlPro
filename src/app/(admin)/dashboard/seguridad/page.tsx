'use client';

import { useInstitution } from '@/app/(admin)/institution-context';
import FilterConfig from '@/components/admin/FilterConfig';
import { ShieldCheck, Lock, Globe } from 'lucide-react';

export default function SecurityPage() {
  const { institutionId } = useInstitution();

  if (!institutionId) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="animate-pulse text-slate-400 font-black uppercase tracking-widest">
          Cargando parámetros de EFAS ServiControlPro...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter italic">
            <span className="text-slate-900">EFAS</span>{' '}
            <span className="text-orange-500">ServiControlPro</span>
          </h1>
          <p className="text-slate-500 text-sm font-bold mt-1">
            Servidor Web para Control Parental Multi-Usuarios
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Sistema Activo</span>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          {/* Inyectamos el ID validado para operaciones de base de datos */}
          <FilterConfig activeId={institutionId} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-200">
            <Lock className="w-10 h-10 text-orange-500 mb-4" />
            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">Protección Global</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Sincronización instantánea con el ecosistema ServiControlPro.
            </p>
            <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Firewall Status</span>
                <span className="text-orange-500">Encrypted</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Red Latency</span>
                <span className="text-emerald-400">&lt; 100ms</span>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-[2.5rem] p-8 border border-orange-100">
            <Globe className="w-10 h-10 text-orange-600 mb-4" />
            <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Funcionamiento</h3>
            <ul className="mt-4 space-y-3">
              <li className="text-xs text-slate-600 font-bold flex gap-3">
                <span className="bg-orange-200 text-orange-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0">1</span>
                Define dominios en la Blacklist.
              </li>
              <li className="text-xs text-slate-600 font-bold flex gap-3">
                <span className="bg-orange-200 text-orange-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0">2</span>
                El Agente ServiControlPro intercepta la solicitud.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
