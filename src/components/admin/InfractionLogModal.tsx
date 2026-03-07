'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { dbService } from '@/lib/dbService';
import { format } from 'date-fns';
import { Globe, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';  // ← AÑADIDO ShieldCheck

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
        // Obtener incidencias de Firebase (subcolección del dispositivo)
        // Nota: dbService debe tener un método para subcolecciones
        const { mode, url } = dbService.getSettings();
        
        // Por ahora, usamos fetch directo a Firebase
        // En el futuro, esto debería ir por dbService
        const response = await fetch(`/api/incidencias?deviceId=${deviceId}`);
        const data = await response.json();
        setIncidencias(data);
        
      } catch (error) {
        console.error("Error cargando incidencias:", error);
      } finally {
        setLoading(false);
      }
    };

    cargarIncidencias();
  }, [isOpen, deviceId]);

  // Filtrar solo las de hoy
  const incidenciasHoy = incidencias.filter(inc => {
    if (!inc.timestamp) return false;
    const fecha = inc.timestamp.toDate ? inc.timestamp.toDate() : new Date(inc.timestamp);
    const hoy = new Date();
    return fecha.getDate() === hoy.getDate() &&
           fecha.getMonth() === hoy.getMonth() &&
           fecha.getFullYear() === hoy.getFullYear();
  }).sort((a, b) => {
    const fechaA = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
    const fechaB = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
    return fechaB.getTime() - fechaA.getTime();
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[#0f1117] border border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-white font-black italic uppercase tracking-tighter">
            🛡️ INCIDENCIAS DE HOY
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-[10px] uppercase tracking-wider">
            Mostrando intentos de acceso a sitios bloqueados para {alumnoNombre || 'el alumno'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-4 custom-scrollbar">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-[10px] text-slate-500">CARGANDO INCIDENCIAS...</p>
            </div>
          ) : incidenciasHoy.length > 0 ? (
            incidenciasHoy.map((inc, index) => (
              <div key={index} className="flex items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="font-mono text-xs text-white truncate max-w-[200px]" title={inc.url || inc.descripcion}>
                      {inc.url || inc.descripcion || 'Sitio bloqueado'}
                    </p>
                    <p className="text-[8px] text-slate-500 uppercase mt-1">
                      {inc.tipo || 'BLOQUEO'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 shrink-0">
                  <Clock className="h-3 w-3" />
                  <span>
                    {inc.timestamp?.toDate 
                      ? format(inc.timestamp.toDate(), 'HH:mm:ss')
                      : format(new Date(inc.timestamp), 'HH:mm:ss')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium">Sin infracciones hoy</p>
              <p className="text-[8px] text-slate-700 mt-1 uppercase tracking-wider">TODO TRANQUILO EN CENTINELA</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
