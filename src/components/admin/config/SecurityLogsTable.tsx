'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, rtdb } from '@/firebase/config';
import { ref, onValue, query as rtdbQuery, orderByChild, limitToLast, off, get, startAt } from 'firebase/database';
import { ShieldX, Globe, Clock, Tablet, Loader2, AlertTriangle, Smartphone, ShieldAlert, Lock, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

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
  const [allLogs, setAllLogs] = useState<SecurityAlert[]>([]);
  const [devicesMap, setDevicesMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [availableDevices, setAvailableDevices] = useState<{id: string, name: string}[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('72h');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const devicesLoadedRef = useRef(false);
  const logsUnsubscribeRef = useRef<(() => void) | null>(null);

  const getTimeRangeTimestamp = (range: string): number => {
    const now = Date.now();
    switch(range) {
      case '24h': return now - (24 * 60 * 60 * 1000);
      case '72h': return now - (72 * 60 * 60 * 1000);
      default: return now - (72 * 60 * 60 * 1000);
    }
  };

  const getTimeRangeLabel = (range: string): string => {
    switch(range) {
      case '24h': return 'últimas 24 horas';
      case '72h': return 'últimas 72 horas';
      default: return 'últimas 72 horas';
    }
  };

  // 1. Cargar dispositivos UNA SOLA VEZ
  useEffect(() => {
    if (!institutionId) return;
    if (devicesLoadedRef.current) return;

    const fetchDevices = async () => {
      try {
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await get(dispositivosRef);
        const data = snapshot.val();
        const map = new Map<string, DeviceInfo>();
        const devicesList: {id: string, name: string}[] = [];
        
        if (data) {
          Object.entries(data).forEach(([deviceId, device]: [string, any]) => {
            if (device.InstitutoId === institutionId) {
              const name = device.alumno_asignado || device.nombre || 'Sin asignar';
              map.set(deviceId, {
                deviceId: deviceId,
                alumno_asignado: name,
                nombre: device.nombre,
                aulaId: device.aulaId || '—',
                seccion: device.seccion || '—',
                InstitutoId: device.InstitutoId
              });
              devicesList.push({ id: deviceId, name: `${name} (${deviceId.slice(-4)})` });
            }
          });
        }
        
        devicesList.sort((a, b) => a.name.localeCompare(b.name));
        devicesList.unshift({ id: 'all', name: '📱 TODOS LOS DISPOSITIVOS' });
        
        console.log(`📱 Dispositivos cargados: ${map.size}`);
        setDevicesMap(map);
        setAvailableDevices(devicesList);
        devicesLoadedRef.current = true;
      } catch (error) {
        console.error('Error cargando dispositivos:', error);
        devicesLoadedRef.current = true;
      }
    };
    
    fetchDevices();
  }, [institutionId]);

  // 2. Escuchar alertas con filtro por tiempo y dispositivo
  useEffect(() => {
    if (!institutionId) return;
    if (!devicesLoadedRef.current) return;
    
    if (logsUnsubscribeRef.current) {
      logsUnsubscribeRef.current();
      logsUnsubscribeRef.current = null;
    }
    
    setLoading(true);
    
    const alertasRef = ref(rtdb, 'alertas_seguridad');
    const timeLimit = getTimeRangeTimestamp(timeRange);
    
    const alertsQuery = rtdbQuery(alertasRef, orderByChild('timestamp'), startAt(timeLimit));
    console.log(`📅 Consultando alertas ${getTimeRangeLabel(timeRange)} desde: ${new Date(timeLimit).toLocaleString()}`);
    
    const unsubscribe = onValue(alertsQuery, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setAllLogs([]);
        setLogs([]);
        setLoading(false);
        return;
      }
      
      const alertsList: SecurityAlert[] = Object.entries(data)
        .map(([key, value]: [string, any]) => ({
          id: key,
          tipo: value.tipo || 'desconocido',
          detalle: value.detalle || '',
          timestamp: value.timestamp || 0,
          deviceId: value.deviceId || ''
        }))
        .filter(alert => {
          const isBlockAlert = [
            'busqueda_prohibida', 'url_prohibida', 'app_prohibida', 
            'app_restringida', 'configuracion_navegador', 'ajustes_sistema',
            'modo_blindado', 'admin_desactivado', 'intento_desactivar_admin'
          ].includes(alert.tipo);
          
          if (!isBlockAlert) return false;
          
          const deviceInfo = devicesMap.get(alert.deviceId);
          return deviceInfo !== undefined;
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      
      console.log(`🚨 Alertas encontradas: ${alertsList.length} (${getTimeRangeLabel(timeRange)})`);
      setAllLogs(alertsList);
      setLoading(false);
    }, (err) => {
      console.error("Error cargando alertas:", err);
      setLoading(false);
    });

    logsUnsubscribeRef.current = () => unsubscribe();

    return () => {
      if (logsUnsubscribeRef.current) {
        logsUnsubscribeRef.current();
        logsUnsubscribeRef.current = null;
      }
    };
  }, [institutionId, devicesMap, timeRange]);

  // 3. Filtrar logs por dispositivo
  const filteredLogs = useMemo(() => {
    if (selectedDevice === 'all') {
      return allLogs;
    }
    return allLogs.filter(log => log.deviceId === selectedDevice);
  }, [allLogs, selectedDevice]);

  // 4. Paginación
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredLogs.slice(start, end);
  }, [filteredLogs, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDevice, timeRange]);

  const getDeviceInfo = useCallback((deviceId: string) => {
    return devicesMap.get(deviceId) || {
      deviceId: deviceId,
      alumno_asignado: 'Sin asignar',
      aulaId: '—',
      seccion: '—'
    };
  }, [devicesMap]);

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

  if (loading && !devicesLoadedRef.current) {
    return (
      <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-12 text-center shadow-2xl">
        <Loader2 className="animate-spin w-8 h-8 text-orange-500 mx-auto mb-6" />
        <p className="text-orange-500 font-black text-[11px] uppercase tracking-[0.3em] italic">Sincronizando Centinela...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6 mt-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2 rounded-xl">
            <ShieldX className="text-red-500 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black italic uppercase text-white tracking-tighter leading-tight">
              Alertas <span className="text-red-500">EDUControlPro</span>
            </h2>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              Monitoreo de Restricciones | Sede: {institutionId}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* FILTRO POR RANGO DE TIEMPO */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-slate-300 shadow-sm">
            <Clock size={12} className="text-slate-600" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-[10px] font-black text-slate-800 uppercase tracking-wider focus:outline-none cursor-pointer"
            >
              <option value="24h">ÚLTIMAS 24 HORAS</option>
              <option value="72h">ÚLTIMAS 72 HORAS</option>
            </select>
          </div>

          {/* FILTRO POR DISPOSITIVO */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-slate-300 shadow-sm">
            <Filter size={12} className="text-slate-600" />
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="bg-transparent text-[10px] font-black text-slate-800 uppercase tracking-wider focus:outline-none cursor-pointer max-w-[200px]"
            >
              {availableDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CONTADOR DE RESULTADOS */}
      <div className="flex justify-between items-center">
        <p className="text-[9px] text-slate-500">
          Mostrando {paginatedLogs.length} de {filteredLogs.length} alertas ({getTimeRangeLabel(timeRange)})
        </p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Auditor en Vivo</span>
        </div>
      </div>

      {/* LISTA DE ALERTAS */}
      <div className="space-y-3">
        {paginatedLogs.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl">
            <ShieldX className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-30" />
            <p className="text-[10px] text-slate-600 font-black uppercase italic">
              Sin incidentes registrados
            </p>
            <p className="text-[8px] text-slate-700 mt-2">
              {selectedDevice !== 'all' ? 'Este dispositivo no tiene alertas en las últimas 72 horas' : 'No hay bloqueos en el período seleccionado'}
            </p>
          </div>
        ) : (
          paginatedLogs.map((log) => {
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

      {/* PAGINACIÓN */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={16} className="text-white" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={16} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}