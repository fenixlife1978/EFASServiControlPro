'use client';

import { ShieldAlert, History, Activity, Globe } from 'lucide-react';

export default function InfraccionesLogs({ logs }: { logs: any[] }) {
  // Ordenamos los logs por los más recientes si no vienen ordenados
  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);

  return (
    <div className="bg-[#0b0d12] rounded-[2rem] p-6 mt-4 overflow-hidden border border-white/5 shadow-2xl relative">
      {/* Indicador de Status Live */}
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
                  Log de <span className="text-red-500">Infracciones</span>
              </p>
              <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest mt-1">Realtime Feed</p>
            </div>
        </div>
        <History className="w-3 h-3 text-slate-700 hover:text-orange-500 transition-colors cursor-help" />
      </div>

      {/* Contenedor de Lista */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar min-h-[100px]">
        {sortedLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center opacity-30 grayscale">
            <ShieldAlert className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-[0.2em]">
                Sin actividad fuera de protocolo
            </p>
          </div>
        ) : (
          sortedLogs.map((log) => (
            <div 
                key={log.id || Math.random()} 
                className="flex justify-between items-center bg-white/[0.02] p-3 rounded-2xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-slate-900 p-1.5 rounded-lg border border-white/5 group-hover:border-red-500/30 transition-colors">
                  <Globe className="w-3 h-3 text-slate-600 group-hover:text-red-500" />
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="text-[7px] font-black text-red-500/70 uppercase tracking-tighter leading-none italic">
                      Interceptado
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 truncate max-w-[180px] group-hover:text-white transition-colors">
                      {log.url || log.descripcion || 'Acceso Restringido'}
                  </span>
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-500 font-black tabular-nums bg-black/40 px-2 py-1 rounded-lg border border-white/5 shadow-inner">
                    {log.hora || '00:00'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Branding */}
      <div className="mt-5 pt-3 border-t border-white/5 flex justify-between items-center">
        <p className="text-[7px] font-black text-slate-700 uppercase tracking-widest italic">
            Centinela Engine v2.4
        </p>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-red-500/40 animate-pulse" />
          <div className="w-1 h-1 rounded-full bg-red-500/20" />
        </div>
      </div>

      {/* Estilos de Scrollbar Personalizados */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ef4444;
        }
      `}</style>
    </div>
  );
}