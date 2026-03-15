'use client';

import { ReportCharts } from "@/components/admin/report-charts";

export default function ReportsPage() {
  return (
    <div className="space-y-8 p-6 lg:p-10 min-h-screen bg-[#f8fafc]">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black italic uppercase text-slate-900 tracking-tighter">
            Monitor de <span className="text-orange-500">Reportes</span>
          </h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Visualiza el uso de dispositivos y las infracciones en tiempo real vía RTDB
          </p>
        </div>
      </header>
      
      {/* Nota: La lógica de migración de Firestore a Realtime Database 
          debe realizarse dentro del componente <ReportCharts /> 
      */}
      <ReportCharts />
    </div>
  );
}
