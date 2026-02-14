'use client';

export default function InfraccionesLogs({ logs }: { logs: any[] }) {
  return (
    <div className="bg-slate-900 rounded-2xl p-4 mt-2 overflow-hidden border border-slate-800">
      <p className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">Historial de Bloqueos (Hoy)</p>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <p className="text-xs text-slate-600 italic">Sin actividad sospechosa detectada.</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-white/5">
              <span className="text-[10px] font-mono text-red-400 truncate max-w-[180px]">{log.url}</span>
              <span className="text-[9px] text-slate-500 font-bold">{log.hora}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}