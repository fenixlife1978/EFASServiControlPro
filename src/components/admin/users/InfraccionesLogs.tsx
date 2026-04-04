'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { ShieldAlert, History, Activity, Globe, AlertTriangle, Smartphone, ShieldX } from 'lucide-react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';

interface SecurityLog {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  dispositivoNombre?: string;
}

interface DeviceInfo {
  deviceId: string;
  alumno_asignado: string;
  aulaId: string;
  seccion: string;
}

export default function InfraccionesLogs() {
  const { institutionId } = useInstitution();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [validDevicesMap, setValidDevicesMap] = useState<Map<string, DeviceInfo>>(new Map());

  // 1. Cargar dispositivos de la sede
  useEffect(() => {
    if (!institutionId) return;

    const dispositivosRef = ref(rtdb, 'dispositivos');
    
    const unsubscribe = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      const map = new Map<string, DeviceInfo>();
      
      if (data) {
        Object.entries(data).forEach(([deviceId, device]: [string, any]) => {
          if (device.InstitutoId === institutionId) {
            map.set(deviceId, {
              deviceId: deviceId,
              alumno_asignado: device.alumno_asignado || device.nombre || 'Sin asignar',
              aulaId: device.aulaId || '—',
              seccion: device.seccion || '—'
            });
          }
        });
      }
      
      setValidDevicesMap(map);
    });

    return () => unsubscribe();
  }, [institutionId]);

  // 2. Escuchar alertas en tiempo real
  useEffect(() => {
    if (!institutionId) return;

    const alertasRef = ref(rtdb, 'alertas_seguridad');
    const recentQuery = query(alertasRef, orderByChild('timestamp'), limitToLast(20));
    
    const unsubscribe = onValue(recentQuery, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setLogs([]);
        setLoading(false);
        return;
      }
      
      // Convertir y filtrar alertas
      const alertsList: SecurityLog[] = [];
      
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        const deviceId = value.deviceId || '';
        const deviceInfo = validDevicesMap.get(deviceId);
        
        // Solo alertas de bloqueo y de dispositivos de esta sede
        const isBlockAlert = [
          'busqueda_prohibida', 
          'url_prohibida',
          'app_prohibida', 
          'app_restringida',
          'configuracion_navegador', 
          'ajustes_sistema',
          'modo_blindado'
        ].includes(value.tipo);
        
        if (isBlockAlert && deviceInfo) {
          alertsList.push({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: deviceId,
            dispositivoNombre: deviceInfo.alumno_asignado
          });
        }
      });
      
      // Ordenar por timestamp descendente y tomar los 15 más recientes
      const sortedAlerts = alertsList
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15);
      
      setLogs(sortedAlerts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId, validDevicesMap]);

  // Formatear hora
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Obtener descripción del bloqueo
  const getDescripcion = (log: SecurityLog) => {
    switch(log.tipo) {
      case 'busqueda_prohibida':
        const matchB = log.detalle.match(/palabra: (\w+)/i);
        return matchB ? `Búsqueda: "${matchB[1]}"` : 'Búsqueda prohibida';
      case 'url_prohibida':
        const matchU = log.detalle.match(/dominio "([^"]+)"/i);
        return matchU ? `URL: ${matchU[1]}` : 'URL bloqueada';
      case 'app_prohibida':
      case 'app_restringida':
        const appMatch = log.detalle.match(/abrir: ([\w.]+)/i);
        return appMatch ? `App: ${appMatch[1].split('.').pop()}` : 'App prohibida';
      case 'configuracion_navegador':
        return 'Configuración navegador';
      case 'ajustes_sistema':
        return 'Ajustes del sistema';
      case 'modo_blindado':
        return 'Intento desactivar blindaje';
      default:
        return log.detalle.substring(0, 30);
    }
  };

  // Obtener icono según tipo
  const getIcon = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
      case 'url_prohibida':
        return <Globe className="w-3 h-3" />;
      case 'app_prohibida':
      case 'app_restringida':
        return <Smartphone className="w-3 h-3" />;
      case 'configuracion_navegador':
      case 'ajustes_sistema':
        return <ShieldX className="w-3 h-3" />;
      default:
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  // Obtener etiqueta del tipo
  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return 'BÚSQUEDA';
      case 'url_prohibida':
        return 'URL';
      case 'app_prohibida':
      case 'app_restringida':
        return 'APP';
      default:
        return 'SISTEMA';
    }
  };

  if (!institutionId) {
    return (
      <div className="bg-[#0b0d12] rounded-[2rem] p-6 mt-4 border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
                Log de <span className="text-red-500">Infracciones</span>
              </p>
              <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest mt-1">Selecciona una sede</p>
            </div>
          </div>
        </div>
        <div className="py-12 flex flex-col items-center justify-center opacity-30 grayscale">
          <ShieldAlert className="w-8 h-8 text-slate-700 mb-3" />
          <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-[0.2em]">
            Sin sede seleccionada
          </p>
        </div>
      </div>
    );
  }

  if (loading && validDevicesMap.size === 0) {
    return (
      <div className="bg-[#0b0d12] rounded-[2rem] p-6 mt-4 border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
                Log de <span className="text-red-500">Infracciones</span>
              </p>
              <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest mt-1">Cargando...</p>
            </div>
          </div>
        </div>
        <div className="py-12 flex flex-col items-center justify-center">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

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
            <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest mt-1">
              Realtime Feed • {logs.length} registros
            </p>
          </div>
        </div>
        <History className="w-3 h-3 text-slate-700 hover:text-orange-500 transition-colors cursor-help" />
      </div>

      {/* Contenedor de Lista */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar min-h-[100px]">
        {logs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center opacity-30 grayscale">
            <ShieldAlert className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-[0.2em]">
              Sin actividad fuera de protocolo
            </p>
            <p className="text-[7px] text-slate-600 mt-2">
              Sede: {institutionId}
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className="flex justify-between items-center bg-white/[0.02] p-3 rounded-2xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className="bg-slate-900 p-1.5 rounded-lg border border-white/5 group-hover:border-red-500/30 transition-colors">
                  <div className={`${log.tipo === 'app_prohibida' ? 'text-orange-500' : 'text-red-500'} group-hover:text-red-500`}>
                    {getIcon(log.tipo)}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-black text-red-500/70 uppercase tracking-tighter leading-none italic">
                      {getTipoLabel(log.tipo)}
                    </span>
                    <span className="text-[7px] text-slate-500 truncate">
                      {log.dispositivoNombre || log.deviceId.substring(0, 8)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 truncate max-w-[200px] group-hover:text-white transition-colors">
                    {getDescripcion(log)}
                  </span>
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-500 font-black tabular-nums bg-black/40 px-2 py-1 rounded-lg border border-white/5 shadow-inner">
                  {formatTime(log.timestamp)}
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
