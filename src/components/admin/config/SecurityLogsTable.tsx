'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collectionGroup, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { ShieldX, Globe, Clock, Tablet, Loader2 } from 'lucide-react';

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
    if (!institutionId) return;
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
    }, (error) => {
      console.error("Auditoría EDUControlPro Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId]);

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6 mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2 rounded-xl">
            <ShieldX className="text-red-500 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black italic uppercase text-white tracking-tighter leading-tight">
              Alertas <span className="text-red-500">EDUControlPro</span>
            </h2>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Monitoreo de Restricciones Activo</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-red-500/5 px-3 py-1.5 rounded-full border border-red-500/10 animate-pulse">
          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Auditor en Vivo</span>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" /></div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl text-[10px] text-slate-600 font-black uppercase italic">
            Sin incidentes en EDUControlPro
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="group flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-red-500/[0.03] transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900 rounded-xl group-hover:bg-red-500/10 transition-colors">
                  <Globe className="w-4 h-4 text-slate-500 group-hover:text-red-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-slate-200 uppercase truncate max-w-[200px] italic">
                    {(log.url || 'DESCONOCIDO').replace('https://', '').replace('www.', '')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Tablet size={10} className="text-slate-600" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">{log.alumno || log.dispositivoId}</span>
                  </div>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400">
                  {log.timestamp?.toDate().toLocaleTimeString()}
                </span>
                <span className="text-[7px] bg-red-600 text-white font-black px-2 py-0.5 rounded uppercase italic">
                  Bloqueado
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="w-full py-4 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest border-t border-white/5 mt-4 transition-all">
        Auditoría Completa de EDUControlPro
      </button>
    </div>
  );
}