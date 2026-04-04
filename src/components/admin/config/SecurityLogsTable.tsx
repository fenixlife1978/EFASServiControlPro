'use client';

import React, { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, onValue, query as rtdbQuery, orderByChild, limitToLast, off, get } from 'firebase/database';
import { ShieldX, Globe, Clock, Tablet, Loader2, AlertTriangle, Smartphone, ShieldAlert, Lock } from 'lucide-react';

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
}

interface DeviceInfo {
  deviceId: string;
  alumno_asignado?: string;
  nombre?: string;
  aulaId?: string;
  seccion?: string;
  InstitutoId?: string;
}

export function SecurityLogsTable({ institutionId }: { institutionId: string }) {
  const [logs, setLogs] = useState<SecurityAlert[]>([]);
  const [devicesMap, setDevicesMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [devicesLoaded, setDevicesLoaded] = useState(false);

  // 1. 🔥 Cargar dispositivos DESDE RTDB (donde está alumno_asignado)
  useEffect(() => {
    if (!institutionId) return;

    const fetchDevices = async () => {
      try {
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await get(dispositivosRef);
        const data = snapshot.val();
        const map = new Map<string, DeviceInfo>();
        
        if (data) {
          Object.entries(data).forEach(([deviceId, device]: [string, any]) => {
            // Verificar que el dispositivo pertenezca a esta sede
            if (device.InstitutoId === institutionId) {
              map.set(deviceId, {
                deviceId: deviceId,
                alumno_asignado: device.alumno_asignado || device.nombre || 'Sin asignar',
                nombre: device.nombre,
                aulaId: device.aulaId || '—',
                seccion: device.seccion || '—',
                InstitutoId: device.InstitutoId
              });
            }
          });
        }
        
        console.log(`📱 SecurityLogsTable - Dispositivos cargados para sede ${institutionId}: ${map.size}`);
        setDevicesMap(map);
        setDevicesLoaded(true);
      } catch (error) {
        console.error('Error cargando dispositivos:', error);
        setDevicesLoaded(true);
      }
    };
    
    fetchDevices();
  }, [institutionId]);

  // 2. Escuchar alertas desde RTDB (alertas_seguridad)
  useEffect(() => {
    if (!institutionId) return;
    if (!devicesLoaded) return; // Esperar a que los dispositivos estén cargados
    
    const alertasRef = ref(rtdb, 'alertas_seguridad');
    const recentQuery = rtdbQuery(alertasRef, orderByChild('timestamp'), limitToLast(50)); // Últimas 50 alertas
    
    const unsubscribe = onValue(recentQuery, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setLogs([]);
        setLoading(false);
        return;
      }
      
      // Filtrar alertas de dispositivos de esta sede
      const alertsList: SecurityAlert[] = Object.entries(data)
        .map(([key, value]: [string, any]) => ({
          id: key,
          tipo: value.tipo || 'desconocido',
          detalle: value.detalle || '',
          timestamp: value.timestamp || 0,
          deviceId: value.deviceId || ''
        }))
        .filter(alert => {
          // Incluir TODOS los tipos de alertas de bloqueo
          const isBlockAlert = [
            'busqueda_prohibida', 
            'url_prohibida',
            'app_prohibida', 
            'app_restringida',
            'configuracion_navegador', 
            'ajustes_sistema',
            'modo_blindado',
            'admin_desactivado',
            'intento_desactivar_admin'
          ].includes(alert.tipo);
          
          if (!isBlockAlert) return false;
          
          // Verificar que el dispositivo pertenezca a esta sede
          const deviceInfo = devicesMap.get(alert.deviceId);
          return deviceInfo !== undefined;
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15); // Últimas 15 alertas
      
      console.log(`🚨 SecurityLogsTable - Alertas para sede ${institutionId}: ${alertsList.length}`);
      setLogs(alertsList);
      setLoading(false);
    }, (err) => {
      console.error("Auditoría EDUControlPro Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId, devicesMap, devicesLoaded]);

  // 3. Función para obtener información del dispositivo
  const getDeviceInfo = (deviceId: string) => {
    return devicesMap.get(deviceId) || {
      deviceId: deviceId,
      alumno_asignado: 'Sin asignar',
      aulaId: '—',
      seccion: '—'
    };
  };

  // 4. Función para obtener el tipo de alerta formateado
  const getTipoInfo = (tipo: string, detalle: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        const match = detalle.match(/palabra: (\w+)/i);
        return { 
          label: match ? `"${match[1]}"` : 'Búsqueda prohibida', 
          icon: <Globe className="w-4 h-4" />,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10'
        };
      case 'url_prohibida':
        const urlMatch = detalle.match(/dominio "([^"]+)"/i);
        return { 
          label: urlMatch ? `URL: ${urlMatch[1]}` : 'URL bloqueada', 
          icon: <Globe className="w-4 h-4" />,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10'
        };
      case 'app_prohibida':
      case 'app_restringida':
        const appMatch = detalle.match(/abrir: ([\w.]+)/i);
        const appName = appMatch ? appMatch[1].split('.').pop() || 'App' : 'App prohibida';
        return { 
          label: appName, 
          icon: <Smartphone className="w-4 h-4" />,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10'
        };
      case 'configuracion_navegador':
        return { 
          label: 'Configuración navegador', 
          icon: <ShieldAlert className="w-4 h-4" />,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10'
        };
      case 'ajustes_sistema':
        return { 
          label: 'Ajustes del sistema', 
          icon: <ShieldX className="w-4 h-4" />,
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10'
        };
      case 'modo_blindado':
        return { 
          label: 'Intento desactivar blindaje', 
          icon: <Lock className="w-4 h-4" />,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10'
        };
      case 'admin_desactivado':
      case 'intento_desactivar_admin':
        return { 
          label: 'Intento quitar permisos admin', 
          icon: <ShieldX className="w-4 h-4" />,
          color: 'text-red-600',
          bgColor: 'bg-red-500/20'
        };
      default:
        return { 
          label: detalle.substring(0, 25), 
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-slate-500',
          bgColor: 'bg-slate-500/10'
        };
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Hoy ${formatTime(timestamp)}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Ayer ${formatTime(timestamp)}`;
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' + formatTime(timestamp);
    }
  };

  if (loading && !devicesLoaded) {
    return (
      <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-12 text-center shadow-2xl">
        <Loader2 className="animate-spin w-8 h-8 text-orange-500 mx-auto mb-6" />
        <p className="text-orange-500 font-black text-[11px] uppercase tracking-[0.3em] italic">Sincronizando Centinela...</p>
      </div>
    );
  }

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
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              Monitoreo de Restricciones Activo | Sede: {institutionId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-red-500/5 px-3 py-1.5 rounded-full border border-red-500/10">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Auditor en Vivo</span>
        </div>
      </div>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl">
            <ShieldX className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-30" />
            <p className="text-[10px] text-slate-600 font-black uppercase italic">
              Sin incidentes registrados en el perímetro de seguridad
            </p>
            <p className="text-[8px] text-slate-700 mt-2">
              Los bloqueos de apps, URLs y configuraciones aparecerán aquí
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const devInfo = getDeviceInfo(log.deviceId);
            const tipoInfo = getTipoInfo(log.tipo, log.detalle);
            return (
              <div key={log.id} className="group flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-red-500/[0.03] transition-all">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`p-3 rounded-xl transition-colors ${tipoInfo.bgColor}`}>
                    {React.cloneElement(tipoInfo.icon, { className: `w-4 h-4 ${tipoInfo.color}` })}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] font-black text-slate-200 uppercase truncate max-w-[250px] italic">
                        {tipoInfo.label}
                      </p>
                      <span className="text-[7px] bg-red-600 text-white font-black px-2 py-0.5 rounded uppercase italic">
                        Bloqueado
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Tablet size={10} className="text-slate-600" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          {devInfo.alumno_asignado}
                        </span>
                      </div>
                      {devInfo.aulaId !== '—' && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-slate-600">📚</span>
                          <span className="text-[8px] text-slate-500">
                            {devInfo.aulaId}/{devInfo.seccion}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-slate-600" />
                        <span className="text-[9px] font-mono text-slate-500">
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[8px] text-slate-600 font-mono">
                    {log.deviceId.substring(0, 10)}...
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {logs.length > 0 && (
        <button 
          onClick={() => {
            // Expandir a más registros (puedes implementar un modal)
            console.log('Ver más alertas');
          }}
          className="w-full py-4 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest border-t border-white/5 mt-4 transition-all"
        >
          Auditoría Completa de EDUControlPro
        </button>
      )}
    </div>
  );
}