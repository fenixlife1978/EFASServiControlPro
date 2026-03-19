'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { rtdb } from '@/firebase/config';
import { ref, onValue, off, query, limitToLast } from 'firebase/database';
import { format } from 'date-fns';
import { Globe, Clock, Activity, User, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InfractionLogModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  alumnoNombre: string;
}

export function InfractionLogModal({ isOpen, onOpenChange, deviceId, alumnoNombre }: InfractionLogModalProps) {
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper para manejar timestamps (RTDB suele ser número, Firestore es objeto)
  const parseDate = (ts: any) => {
    if (!ts) return new Date();
    if (typeof ts === 'number') return new Date(ts);
    if (ts.seconds) return new Date(ts.seconds * 1000);
    return new Date(ts);
  };

  useEffect(() => {
    if (!isOpen || !deviceId) return;

    setLoading(true);

    // ESTRATEGIA HÍBRIDA: Leemos de RTDB para ahorrar cuota de Firestore
    // Buscamos en el nodo 'incidencias_live' que es volátil y rápido
    const logRef = query(ref(rtdb, `incidencias_live/${deviceId}`), limitToLast(50));

    const unsubscribe = onValue(logRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convertimos el objeto de RTDB en Array y ordenamos por el más reciente
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val
        })).sort((a, b) => parseDate(b.timestamp).getTime() - parseDate(a.timestamp).getTime());
        
        setIncidencias(list);
      } else {
        setIncidencias([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error RTDB Centinela:", error);
      setLoading(false);
    });

    return () => off(logRef);
  }, [isOpen, deviceId]);

  // Estadísticas en tiempo real (useMemo para no recalcular en cada render)
  const stats = useMemo(() => {
    if (incidencias.length === 0) return { total: 0, principal: 'Ninguna' };
    
    const tipos = incidencias.reduce((acc: any, curr) => {
      const tipo = curr.tipo || 'BLOQUEO_WEB';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});
    
    const principal = Object.keys(tipos).reduce((a, b) => tipos[a] > tipos[b] ? a : b);
    
    return { total: incidencias.length, principal };
  }, [incidencias]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0b0d12] border border-white/5 text-white rounded-[2.5rem] shadow-2xl overflow-hidden p-0">
        
        {/* Encabezado Estilo Dark Panel */}
        <div className="p-6 pb-2 bg-gradient-to-b from-red-500/10 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-500/20 p-2 rounded-xl border border-red-500/30">
                  <Activity className="h-5 w-5 text-red-500 animate-pulse" />
              </div>
              <DialogTitle className="text-white font-black italic uppercase tracking-tighter text-xl leading-none">
                Log de <span className="text-red-500">Infracciones</span>
              </DialogTitle>
            </div>
            <DialogDescription className="flex items-center gap-2 text-slate-500 text-[9px] uppercase font-black tracking-[0.2em]">
              <User className="h-3 w-3" /> 
              ID: <span className="text-slate-300">{deviceId}</span> | Agente: <span className="text-slate-300">{alumnoNombre || 'Sin Asignar'}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Banner de Resumen */}
          {incidencias.length > 0 && (
            <div className="mt-4 p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl flex items-center gap-4">
              <div className="bg-orange-500/20 p-2.5 rounded-xl">
                <Zap className="h-4 w-4 text-orange-500 fill-orange-500/20" />
              </div>
              <div>
                <p className="text-[10px] font-black text-orange-500 uppercase italic tracking-widest leading-none mb-1">Análisis de Red</p>
                <p className="text-[11px] text-slate-300 font-bold leading-tight">
                  {stats.total} intentos detectados hoy. <span className="text-white underline decoration-orange-500/50">{stats.principal}</span> es la mayor amenaza.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Lista de Incidencias (RTDB Live) */}
        <div className="px-6 py-4 space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar min-h-[200px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin w-8 h-8 text-orange-500 mb-4" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Sincronizando con Centinela...</p>
            </div>
          ) : incidencias.length > 0 ? (
            incidencias.map((inc) => (
              <div 
                key={inc.id} 
                className="group flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 hover:border-red-500/40 hover:bg-red-500/5 transition-all duration-300"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl group-hover:border-red-500/20 transition-all">
                    <Globe className="h-4 w-4 text-slate-500 group-hover:text-red-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-mono text-[10px] font-bold text-slate-200 truncate group-hover:text-white">
                      {inc.url || inc.descripcion || 'CONTENIDO_RESTRINGIDO'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-red-500/10 text-red-500 border-none text-[7px] font-black px-1.5 h-4 uppercase italic">
                            {inc.tipo || 'BLOQUEO_WEB'}
                        </Badge>
                        <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Estado: Interceptado</span>
                    </div>
                  </div>
                </div>
                
                <div className="shrink-0 bg-black/40 px-2 py-1.5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-slate-600" />
                    <span className="text-[9px] font-black text-slate-400 tabular-nums">
                      {format(parseDate(inc.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-slate-950/30 rounded-[2.5rem] border border-dashed border-slate-800 mx-2">
              <ShieldCheck className="w-10 h-10 text-slate-800 mb-4" />
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Escudo Activo</p>
              <p className="text-[8px] text-slate-700 mt-2 font-bold uppercase italic tracking-widest">Sin infracciones registradas</p>
            </div>
          )}
        </div>

        {/* Footer Institucional */}
        <div className="p-4 text-center border-t border-white/5 bg-black/40">
            <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] italic">
                SISTEMA CENTINELA v2.4 | EFAS SOLUCIONES DIGITALES
            </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}