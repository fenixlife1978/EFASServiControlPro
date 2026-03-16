'use client';

import { ShieldAlert, History, Activity } from 'lucide-react';

export default function InfraccionesLogs({ logs }: { logs: any[] }) {
  return (
    <div className="bg-[#0b0d12] rounded-[2rem] p-6 mt-4 overflow-hidden border border-slate-800/50 shadow-inner">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/50 pb-3">
        <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Log de <span className="text-red-500">Infracciones</span>
            </p>
        </div>
        <History className="w-3 h-3 text-slate-600" />
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center opacity-40">
            <ShieldAlert className="w-6 h-6 text-slate-700 mb-2" />
            <p className="text-[9px] font-black text-slate-600 uppercase italic">
                Sin actividad fuera de protocolo
            </p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div 
                key={i} 
                className="flex justify-between items-center bg-slate-900/30 p-3 rounded-xl border border-red-500/10 hover:border-red-500/30 transition-colors group"
            >
              <div className="flex flex-col gap-1 overflow-hidden">
                <span className="text-[8px] font-black text-red-500/60 uppercase tracking-tighter leading-none">
                    Acceso Bloqueado
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-300 truncate max-w-[200px] group-hover:text-red-400 transition-colors">
                    {log.url}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-500 font-black tabular-nums bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                    {log.hora}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/50">
        <p className="text-[8px] font-black text-slate-600 uppercase text-center tracking-widest italic">
            EDUControlPro Security Engine
        </p>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>
    </div>
  );
}