'use client';
import React from 'react';
import { DirectorOverview } from './director-overview';
import { DirectorInventory } from './director-inventory';
import { DirectorLiveMonitor } from './director-live-monitor';
import { Monitor, ShieldCheck } from "lucide-react";

export function DirectorDashboard() {
  const assignedTablets = [
    { codigo: 'TAB-001', modelo: 'Samsung Galaxy Tab A8' },
    { codigo: 'TAB-002', modelo: 'Samsung Galaxy Tab A8' }
  ];

  return (
    <div className="p-6 lg:p-10 space-y-10 bg-[#f8fafc] min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-1 bg-orange-600 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-600">Terminal Supervisión</span>
          </div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Consola de <span className="text-orange-500">Actividad</span>
          </h2>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <div className="leading-none">
            <p className="text-[9px] font-black uppercase text-slate-400">Sistema</p>
            <p className="text-xs font-black text-slate-900 uppercase mt-1">Protegido</p>
          </div>
        </div>
      </div>

      <DirectorOverview />

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <DirectorLiveMonitor />
        </div>
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2 px-2">
            <Monitor className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-black uppercase italic text-slate-900">Recursos Asignados (Vista)</h3>
          </div>
          <DirectorInventory data={assignedTablets} type="tablets" />
        </div>
      </div>
    </div>
  );
}
