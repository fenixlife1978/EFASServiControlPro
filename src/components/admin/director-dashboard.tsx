'use client';
import React from 'react';
import { DirectorOverview } from './director-overview';
import { DirectorInventory } from './director-inventory';
import { DirectorLiveMonitor } from './director-live-monitor';
import { Monitor, ShieldCheck, LayoutGrid } from "lucide-react";

export function DirectorDashboard() {
  // Datos de ejemplo para la vista previa del inventario
  const assignedTablets = [
    { codigo: 'TAB-001', modelo: 'Samsung Galaxy Tab A8', estado: 'online' },
    { codigo: 'TAB-002', modelo: 'Samsung Galaxy Tab A8', estado: 'offline' }
  ];

  return (
    <div className="p-6 lg:p-10 space-y-10 bg-slate-50 min-h-screen">
      {/* Header de la Consola */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-1.5 bg-orange-500 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              EDUControlPro <span className="text-orange-600">v3.0</span>
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-[0.85]">
            Consola de <span className="text-orange-500 underline decoration-slate-900/10 underline-offset-8">Actividad</span>
          </h2>
          <p className="text-[10px] font-bold uppercase text-slate-400 mt-4 ml-1 tracking-widest">
            Panel de supervisión jerárquica y control de aula
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="bg-green-100 p-2 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-green-600" />
          </div>
          <div className="leading-tight">
            <p className="text-[9px] font-black uppercase text-slate-400">Estado Global</p>
            <p className="text-sm font-black text-slate-900 uppercase italic">Sistema Protegido</p>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen (Métricas de Firestore/RTDB) */}
      <DirectorOverview />

      {/* Sección de Monitorización y Recursos */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Lado Izquierdo: Monitor en Tiempo Real (RTDB) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <h3 className="text-xs font-black uppercase italic text-slate-800 tracking-tighter">Monitoreo en Vivo</h3>
          </div>
          <DirectorLiveMonitor />
        </div>

        {/* Lado Derecho: Inventario y Recursos */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-black uppercase italic text-slate-800 tracking-tighter">Inventario de Terminales</h3>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-200/50 px-3 py-1 rounded-full">
              Vista Rápida
            </span>
          </div>
          
          <div className="bg-white rounded-[2.5rem] p-2 border border-slate-200 shadow-sm">
            <DirectorInventory data={assignedTablets} type="tablets" />
          </div>
        </div>
      </div>
    </div>
  );
}
