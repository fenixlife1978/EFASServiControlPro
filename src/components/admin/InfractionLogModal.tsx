'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { dbService } from '@/lib/dbService';
import { format } from 'date-fns';
import { Globe, Clock, Activity, User, ShieldCheck, AlertCircle, Zap } from 'lucide-react';
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

  useEffect(() => {
    if (!isOpen || !deviceId) return;

    const cargarIncidencias = async () => {
      setLoading(true);
      try {
        const data = await dbService.getIncidencias(deviceId);
        setIncidencias(data);
      } catch (error) {
        console.error("Error cargando incidencias de EDUControlPro:", error);
      } finally {
        setLoading(false);
      }
    };

    cargarIncidencias();
  }, [isOpen, deviceId]);

  // Lógica Ultra-Eficiente con useMemo
  const incidenciasHoy = useMemo(() => {
    return incidencias
      .filter(inc => {
        if (!inc.timestamp) return false;
        const fecha = inc.timestamp instanceof Date ? inc.timestamp : new Date(inc.timestamp);
        const hoy = new Date();
        return (
          fecha.getDate() === hoy.getDate() &&
          fecha.getMonth() === hoy.getMonth() &&
          fecha.getFullYear() === hoy.getFullYear()
        );
      })
      .sort((a, b) => {
        const fechaA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const fechaB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return fechaB.getTime() - fechaA.getTime();
      });
  }, [incidencias]);

  // Resumen Estadístico para el Administrador
  const stats = useMemo(() => {
    const total = incidenciasHoy.length;
    const tipos = incidenciasHoy.reduce((acc: any, curr) => {
      const tipo = curr.tipo || 'BLOQUEO_WEB';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});
    
    const principal = Object.keys(tipos).reduce((a, b) => tipos[a] > tipos[b] ? a : b, 'Ninguno');
    
    return { total, principal };
  }, [incidenciasHoy]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0b0d12] border border-slate-800 text-white rounded-[2.5rem] shadow-2xl overflow-hidden">
        
        <DialogHeader className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-500/20 p-2 rounded-lg">
                <Activity className="h-5 w-5 text-red-500 animate-pulse" />
            </div>
            <DialogTitle className="text-white font-black italic uppercase tracking-tighter text-xl">
              Log de <span className="text-red-500">Infracciones</span>
            </DialogTitle>
          </div>
          <DialogDescription className="flex items-center gap-2 text-slate-500 text-[9px] uppercase font-black tracking-[0.15em]">
            <User className="h-3 w-3" /> 
            Agente: <span className="text-slate-300">{alumnoNombre || 'No Identificado'}</span>
          </DialogDescription>
        </DialogHeader>

        {/* SECCIÓN DE RESUMEN ESTADÍSTICO */}
        {incidenciasHoy.length > 0 && (
          <div className="mt-4 p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl flex items-center gap-4">
            <div className="bg-orange-500/20 p-2.5 rounded-xl">
              <Zap className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-500 uppercase italic tracking-widest">Resumen del Turno</p>
              <p className="text-[11px] text-slate-300 font-bold">
                {stats.total} intentos detectados. <span className="text-white underline">{stats.principal}</span> es la categoría más activa.
              </p>
            </div>
          </div>
        )}
        
        <div className="mt-4 space-y-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizando con Centinela...</p>
            </div>
          ) : incidenciasHoy.length > 0 ? (
            incidenciasHoy.map((inc, index) => (
              <div 
                key={inc.id || index} 
                className="group flex items-center justify-between gap-4 rounded-2xl border border-red-500/10 bg-red-500/5 p-4 hover:border-red-500/40 transition-all duration-300"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="bg-red-500/10 p-2 rounded-xl group-hover:bg-red-500/20 transition-colors">
                    <Globe className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-mono text-[11px] font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                      {inc.url || inc.descripcion || 'ACCESO_NO_AUTORIZADO'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-red-500/10 hover:bg-red-500/10 text-red-500 border-none text-[7px] font-black px-1.5 h-4 uppercase italic">
                            {inc.tipo || 'BLOQUEO_WEB'}
                        </Badge>
                        <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Interceptado</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-inner">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span className="text-[10px] font-black text-slate-400 tabular-nums">
                      {inc.timestamp instanceof Date
                        ? format(inc.timestamp, 'HH:mm:ss')
                        : format(new Date(inc.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-slate-950/50 rounded-[2rem] border border-dashed border-slate-800">
              <ShieldCheck className="w-12 h-12 text-slate-800 mx-auto mb-4" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Estatus: Seguro</p>
              <p className="text-[8px] text-slate-700 mt-2 font-bold uppercase italic tracking-widest">Sin violaciones registradas hoy</p>
            </div>
          )}
        </div>

        <div className="mt-2 text-center border-t border-slate-800/50 pt-4">
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">
                SISTEMA CENTINELA v2.4 | EFAS Soluciones Digitales
            </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}