'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collectionGroup, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { ShieldX, Globe, Clock, Tablet } from 'lucide-react';

interface BlockedLog {
  id: string;
  url: string;
  timestamp: Timestamp;
  dispositivoId: string;
  alumno?: string;
  categoria?: string;
}

export function SecurityLogsTable({ institutionId }: { institutionId: string }) {
  const [logs, setLogs] = useState<BlockedLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Buscamos en la sub-colección vpn_logs de todos los dispositivos de esta institución
    const q = query(
      collectionGroup(db, 'vpn_logs'),
      where('InstitutoId', '==', institutionId),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BlockedLog));
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId]);

  return (
    <div className="bg-[#0a0c10] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6 mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldX className="text-red-500 w-5 h-5" />
          <h2 className="text-lg font-black italic uppercase text-white tracking-tighter">Intentos de Acceso Bloqueados</h2>
        </div>
        <div className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 animate-pulse">
          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">En Vivo</span>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div></div>
        ) : logs.length === 0 ? (
          <p className="text-[10px] text-slate-600 uppercase font-bold text-center py-4 italic tracking-widest">No hay infracciones detectadas</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="group flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-red-500/5 transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-red-500/20 transition-colors">
                  <Globe className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-white uppercase truncate max-w-[180px] italic">
                    {log.url.replace('https://', '').replace('www.', '')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Tablet size={10} className="text-slate-600" />
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{log.alumno || log.dispositivoId}</span>
                  </div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center justify-end gap-1 text-slate-500">
                  <Clock size={10} />
                  <span className="text-[8px] font-black uppercase tracking-tighter">
                    {log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-[7px] bg-red-500 text-white font-black px-2 py-0.5 rounded uppercase italic">
                  Bloqueado
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="w-full py-3 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest border-t border-white/5 pt-6 transition-colors">
        Ver Reporte de Auditoría Completo
      </button>
    </div>
  );
}