'use client';

import React, { useState, useEffect } from 'react';
import { rtdb, db } from '@/firebase/config';
import { ref, onValue, query, orderByChild, startAt, limitToLast, get } from 'firebase/database';
import { 
  collection, 
  query as fsQuery, 
  where, 
  getDocs
} from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { 
  Globe, 
  Smartphone, 
  Calendar, 
  Loader2,
  TrendingUp,
  ShieldAlert,
  AlertTriangle,
  Clock,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  InstitutoId?: string;
}

interface DeviceInfo {
  deviceId: string;
  alumno: string;
  institutoId: string;
  aulaId?: string;
  seccion?: string;
  count: number;
}

export function SecurityAnalytics() {
  const { institutionId } = useInstitution();
  const [loading, setLoading] = useState(true);
  const [topDevices, setTopDevices] = useState<DeviceInfo[]>([]);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [alertasRecientes, setAlertasRecientes] = useState<SecurityAlert[]>([]);
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [validDevicesMap, setValidDevicesMap] = useState<Map<string, any>>(new Map());

  // 1. Obtener dispositivos válidos de esta sede desde RTDB
  useEffect(() => {
    if (!institutionId) return;
    
    const fetchDevices = async () => {
      try {
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await get(dispositivosRef);
        const data = snapshot.val();
        
        const map = new Map();
        
        if (data) {
          Object.entries(data).forEach(([deviceId, deviceData]: [string, any]) => {
            // Verificar que el dispositivo pertenezca a esta sede
            if (deviceData.InstitutoId === institutionId) {
              map.set(deviceId, {
                id: deviceId,
                alumno_asignado: deviceData.alumno_asignado || deviceData.nombre || deviceId,
                aulaId: deviceData.aulaId || '—',
                seccion: deviceData.seccion || '—',
                InstitutoId: deviceData.InstitutoId
              });
            }
          });
        }
        
        console.log(`📱 Dispositivos encontrados para sede ${institutionId}: ${map.size}`);
        setValidDevicesMap(map);
      } catch (error) {
        console.error('Error cargando dispositivos:', error);
      }
    };
    
    fetchDevices();
  }, [institutionId]);

  // 2. Escuchar alertas desde RTDB
  useEffect(() => {
    if (!institutionId) return;
    if (validDevicesMap.size === 0 && !loading) {
      setAlertasRecientes([]);
      setTopDevices([]);
      setTotalAttempts(0);
      setLoading(false);
      return;
    }
    
    const now = Date.now();
    const days = period === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    
    const alertasRef = ref(rtdb, 'alertas_seguridad');
    
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setTopDevices([]);
        setTotalAttempts(0);
        setAlertasRecientes([]);
        setLoading(false);
        return;
      }

      // 3. Filtrar alertas por período y por dispositivos de esta sede
      const allAlerts: SecurityAlert[] = Object.entries(data)
        .map(([key, value]: [string, any]) => ({
          id: key,
          tipo: value.tipo || 'desconocido',
          detalle: value.detalle || '',
          timestamp: value.timestamp || 0,
          deviceId: value.deviceId || '',
          InstitutoId: value.InstitutoId || ''
        }))
        .filter(alert => {
          // Filtrar por período
          if (alert.timestamp < cutoff) return false;
          // Filtrar por dispositivo válido de esta sede
          const deviceInfo = validDevicesMap.get(alert.deviceId);
          return deviceInfo !== undefined;
        });

      console.log(`📊 Alertas para sede ${institutionId} en período ${period}: ${allAlerts.length}`);
      
      setTotalAttempts(allAlerts.length);
      
      // 4. Guardar últimas 20 alertas recientes
      const recientes = [...allAlerts]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);
      setAlertasRecientes(recientes);

      // 5. Procesar Top Dispositivos Infractores
      const deviceStats = new Map<string, number>();
      allAlerts.forEach(alert => {
        deviceStats.set(alert.deviceId, (deviceStats.get(alert.deviceId) || 0) + 1);
      });

      const sortedDevices = Array.from(deviceStats.entries())
        .map(([deviceId, count]) => {
          const devData = validDevicesMap.get(deviceId);
          return {
            deviceId,
            alumno: devData?.alumno_asignado || devData?.nombre || 'Sin asignar',
            institutoId: institutionId,
            aulaId: devData?.aulaId || '—',
            seccion: devData?.seccion || '—',
            count
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTopDevices(sortedDevices);
      setLoading(false);
    }, (error) => {
      console.error('Error escuchando alertas:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [period, institutionId, validDevicesMap]);

  const getTipoAlertaIcon = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
      case 'url_prohibida':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'app_prohibida':
      case 'app_restringida':
        return <Smartphone className="w-4 h-4 text-orange-500" />;
      case 'configuracion_navegador':
      case 'ajustes_sistema':
        return <Globe className="w-4 h-4 text-yellow-500" />;
      case 'modo_blindado':
        return <ShieldAlert className="w-4 h-4 text-purple-500" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTipoAlertaLabel = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return 'Búsqueda prohibida';
      case 'url_prohibida':
        return 'URL bloqueada';
      case 'app_prohibida':
      case 'app_restringida':
        return 'App prohibida';
      case 'configuracion_navegador':
        return 'Configuración navegador';
      case 'ajustes_sistema':
        return 'Ajustes del sistema';
      case 'modo_blindado':
        return 'Intento de desactivar blindaje';
      default:
        return tipo;
    }
  };

  const getTipoDetalle = (tipo: string, detalle: string) => {
    if (tipo === 'busqueda_prohibida') {
      const match = detalle.match(/palabra: (\w+)/i);
      return match ? `Búsqueda: "${match[1]}"` : detalle.substring(0, 50);
    }
    if (tipo === 'url_prohibida') {
      const match = detalle.match(/dominio "([^"]+)"/i);
      return match ? `URL: ${match[1]}` : detalle.substring(0, 50);
    }
    return detalle.substring(0, 50);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabecera y Selector de Periodo */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black italic uppercase text-white">
            Centro de <span className="text-orange-500">Análisis</span>
          </h2>
          <p className="text-[9px] text-slate-500 mt-1">
            Sede: {institutionId}
          </p>
        </div>
        <div className="flex gap-2 bg-[#1c212c] p-1 rounded-xl">
          {(['7d', '30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                period === p ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {p === '7d' ? '7 días' : '30 días'}
            </button>
          ))}
        </div>
      </div>

      {/* Card de Resumen Total */}
      <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/10 rounded-2xl">
            <Calendar className="text-orange-500 w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Total Bloqueos</p>
            <p className="text-2xl font-black text-white">{totalAttempts}</p>
            <p className="text-[8px] text-slate-600 mt-1">en los últimos {period === '7d' ? '7' : '30'} días</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="text-orange-500 w-8 h-8 opacity-30" />
          <TrendingUp className="text-emerald-500 w-8 h-8 opacity-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* Top Dispositivos Infractores - Ahora ocupa toda la anchura */}
        <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <Smartphone className="text-blue-500 w-6 h-6" />
            <h3 className="text-lg font-black italic uppercase text-white">
              Dispositivos <span className="text-blue-500">infractores</span>
            </h3>
          </div>

          {topDevices.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-600">
              <Smartphone className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-[10px] uppercase font-black">Sin actividad sospechosa</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] text-slate-500 font-black uppercase tracking-tighter border-b border-white/5">
                    <th className="pb-4">Alumno</th>
                    <th className="pb-4 text-center">Aula/Sec</th>
                    <th className="pb-4 text-right">Intentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {topDevices.map((dev) => (
                    <tr key={dev.deviceId} className="group hover:bg-white/[0.01]">
                      <td className="py-4">
                        <p className="text-xs font-bold text-slate-200">{dev.alumno}</p>
                        <p className="text-[9px] font-mono text-slate-500">{dev.deviceId.substring(0, 12)}...</p>
                       </td>
                      <td className="py-4 text-center">
                        <span className="text-[10px] text-slate-400">
                          {dev.aulaId} / {dev.seccion}
                        </span>
                       </td>
                      <td className="py-4 text-right">
                        <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-[10px] font-black">
                          {dev.count}
                        </span>
                       </td>
                    </tr>
                  ))}
                </tbody>
               </table>
            </div>
          )}
        </div>
      </div>

      {/* Últimas Alertas Recientes */}
      <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <Clock className="text-orange-500 w-6 h-6" />
          <h3 className="text-lg font-black italic uppercase text-white">
            Últimas <span className="text-orange-500">alertas</span> en tiempo real
          </h3>
        </div>

        {alertasRecientes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-600">
            <ShieldAlert className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-[10px] uppercase font-black">No hay alertas recientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertasRecientes.map((alerta) => (
              <div key={alerta.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl hover:bg-white/[0.05] transition-all">
                <div className="flex items-center gap-4 flex-1">
                  {getTipoAlertaIcon(alerta.tipo)}
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">{getTipoAlertaLabel(alerta.tipo)}</p>
                    <p className="text-[10px] text-slate-400">
                      {getTipoDetalle(alerta.tipo, alerta.detalle)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-slate-500 font-mono">{alerta.deviceId.substring(0, 8)}...</span>
                  <span className="text-[9px] text-slate-600">
                    {new Date(alerta.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}