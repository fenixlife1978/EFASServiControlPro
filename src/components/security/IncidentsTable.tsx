'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { rtdb, db } from '@/firebase/config';
import { ref, onValue, off, update, get, set } from 'firebase/database';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ShieldAlert, Globe, Monitor, Clock, CheckCircle, Smartphone, Shield, Filter, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  leido?: boolean;
}

interface DeviceInfo {
  deviceId: string;
  alumno_asignado?: string;
  aulaId?: string;
}

export function IncidentsTable({ institutionId }: { institutionId: string }) {
  const [incidents, setIncidents] = useState<SecurityAlert[]>([]);
  const [allIncidents, setAllIncidents] = useState<SecurityAlert[]>([]);
  const [deviceInfoMap, setDeviceInfoMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [availableDevices, setAvailableDevices] = useState<{id: string, name: string}[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper para obtener timestamp según rango (solo 24h y 72h)
  const getTimeRangeTimestamp = (range: string): number => {
    const now = Date.now();
    switch(range) {
      case '24h': return now - (24 * 60 * 60 * 1000);
      case '72h': return now - (72 * 60 * 60 * 1000);
      default: return now - (72 * 60 * 60 * 1000);
    }
  };

  // Helper para obtener etiqueta del rango
  const getTimeRangeLabel = (range: string): string => {
    switch(range) {
      case '24h': return 'Últimas 24 horas';
      case '72h': return 'Últimas 72 horas';
      default: return 'Últimas 72 horas';
    }
  };

  // 1. Cargar información de dispositivos desde Firestore y RTDB
  useEffect(() => {
    if (!institutionId) return;
    
    const fetchDevices = async () => {
      try {
        // Cargar desde RTDB primero
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await get(dispositivosRef);
        const rtdbData = snapshot.val();
        
        const map = new Map<string, DeviceInfo>();
        const devicesList: {id: string, name: string}[] = [];
        
        if (rtdbData) {
          Object.entries(rtdbData).forEach(([deviceId, device]: [string, any]) => {
            if (device.InstitutoId === institutionId) {
              const name = device.alumno_asignado || device.nombre || 'Sin asignar';
              map.set(deviceId, {
                deviceId: deviceId,
                alumno_asignado: name,
                aulaId: device.aulaId || '—'
              });
              devicesList.push({ id: deviceId, name: `${name} (${deviceId.slice(-4)})` });
            }
          });
        }
        
        devicesList.sort((a, b) => a.name.localeCompare(b.name));
        devicesList.unshift({ id: 'all', name: '📱 TODOS LOS DISPOSITIVOS' });
        
        setDeviceInfoMap(map);
        setAvailableDevices(devicesList);
      } catch (error) {
        console.error('Error cargando dispositivos:', error);
      }
    };
    
    fetchDevices();
  }, [institutionId]);

  // 2. Escuchar alertas desde RTDB (alertas_seguridad)
  useEffect(() => {
    if (!institutionId) return;

    const alertasRef = ref(rtdb, 'alertas_seguridad');
    
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const deviceIds = Array.from(deviceInfoMap.keys());
        
        const alertsList: SecurityAlert[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: value.deviceId || '',
            leido: value.leido || false
          }))
          .filter(alert => deviceIds.includes(alert.deviceId))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setAllIncidents(alertsList);
      } else {
        setAllIncidents([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error en el log de EDUControlPro:", error);
      setLoading(false);
    });

    return () => off(alertasRef);
  }, [institutionId, deviceInfoMap]);

  // 3. Filtrar incidentes por dispositivo y rango de tiempo
  const filteredIncidents = useMemo(() => {
    let result = [...allIncidents];
    
    // Filtrar por dispositivo
    if (selectedDevice !== 'all') {
      result = result.filter(inc => inc.deviceId === selectedDevice);
    }
    
    // Filtrar por rango de tiempo (solo 24h o 72h)
    const timeLimit = getTimeRangeTimestamp(timeRange);
    result = result.filter(inc => inc.timestamp >= timeLimit);
    
    return result;
  }, [allIncidents, selectedDevice, timeRange]);

  // 4. Paginación
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredIncidents.slice(start, end);
  }, [filteredIncidents, currentPage, itemsPerPage]);

  // Resetear página cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDevice, timeRange]);

  // 5. Limpiar TODAS las infracciones de Firebase
  const limpiarTodoFirebase = async () => {
    if (!institutionId) return;
    
    const confirmed = confirm('⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará TODAS las infracciones registradas en Firebase para esta sede.\n\nEsta operación NO se puede deshacer.');
    if (!confirmed) return;
    
    setIsDeleting(true);
    
    try {
      const alertasRef = ref(rtdb, 'alertas_seguridad');
      const snapshot = await get(alertasRef);
      const data = snapshot.val();
      
      if (data) {
        const keysToDelete: string[] = [];
        
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          const deviceId = value.deviceId || '';
          const deviceInfo = deviceInfoMap.get(deviceId);
          
          if (deviceInfo) {
            keysToDelete.push(key);
          }
        });
        
        if (keysToDelete.length > 0) {
          const deletePromises = keysToDelete.map(key => 
            set(ref(rtdb, `alertas_seguridad/${key}`), null)
          );
          await Promise.all(deletePromises);
        }
      }
    } catch (error) {
      console.error('Error eliminando infracciones:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // 6. Marcar alerta como leída en RTDB
  const markAsResolved = async (alertId: string) => {
    try {
      const alertRef = ref(rtdb, `alertas_seguridad/${alertId}`);
      await update(alertRef, { 
        leido: true,
        leido_en: Date.now()
      });
    } catch (error) {
      console.error("Error al actualizar incidencia:", error);
    }
  };

  // 7. Función para obtener el ícono según el tipo de alerta
  const getTipoIcon = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return <Globe size={20} />;
      case 'app_prohibida':
        return <Smartphone size={20} />;
      case 'configuracion_navegador':
      case 'ajustes_sistema':
        return <Shield size={20} />;
      default:
        return <Monitor size={20} />;
    }
  };

  // 8. Función para obtener el label del tipo de alerta
  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return 'BÚSQUEDA PROHIBIDA';
      case 'app_prohibida':
        return 'APP PROHIBIDA';
      case 'configuracion_navegador':
        return 'CONFIGURACIÓN NAVEGADOR';
      case 'ajustes_sistema':
        return 'AJUSTES SISTEMA';
      default:
        return 'ALERTA';
    }
  };

  const formatFecha = (timestamp: number) => {
    if (!timestamp) return "---";
    return new Date(timestamp).toLocaleString();
  };

  const getDeviceInfo = (deviceId: string) => {
    return deviceInfoMap.get(deviceId) || {
      deviceId: deviceId,
      alumno_asignado: 'Sin asignar',
      aulaId: '—'
    };
  };

  const pendingCount = filteredIncidents.filter(i => !i.leido).length;

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-[10px] font-black text-slate-500 uppercase italic">Escaneando registros de seguridad EDUControlPro...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="bg-[#0a0c10] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {/* Header de la Tabla */}
        <div className="p-8 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-3">
                <ShieldAlert className="text-orange-500" size={24} /> Log de Incidencias Global
              </h2>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">
                {getTimeRangeLabel(timeRange)} • {filteredIncidents.length} registros
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Selector de dispositivo */}
              <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-700">
                <Smartphone size={12} className="text-orange-500" />
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="bg-transparent text-[9px] font-black text-white uppercase tracking-wider focus:outline-none cursor-pointer max-w-[180px]"
                >
                  {availableDevices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de rango de tiempo */}
              <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-700">
                <Clock size={12} className="text-orange-500" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-transparent text-[9px] font-black text-white uppercase tracking-wider focus:outline-none cursor-pointer"
                >
                  <option value="24h">ÚLTIMAS 24 HORAS</option>
                  <option value="72h">ÚLTIMAS 72 HORAS</option>
                </select>
              </div>

              {/* Botón LIMPIAR TODO */}
              <button
                onClick={limpiarTodoFirebase}
                disabled={isDeleting}
                className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all"
              >
                <Trash2 size={14} /> LIMPIAR TODO
              </button>

              {/* Contador de pendientes */}
              <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl">
                <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest italic">
                  {pendingCount} Pendientes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CONTADOR Y PAGINACIÓN */}
        <div className="px-6 pt-4 pb-2 flex justify-between items-center border-b border-slate-800">
          <p className="text-[8px] text-slate-500">
            Mostrando {paginatedIncidents.length} de {filteredIncidents.length} incidentes
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={12} className="text-white" />
              </button>
              <span className="text-[8px] text-slate-400 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={12} className="text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Listado */}
        <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
          {paginatedIncidents.length === 0 ? (
            <div className="p-20 text-center opacity-30 italic">
               <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
               <p className="text-xs font-black uppercase tracking-widest">Sin infracciones registradas</p>
               <p className="text-[8px] text-slate-600 mt-2">
                 {selectedDevice !== 'all' ? 'Este dispositivo no tiene alertas en el período seleccionado' : getTimeRangeLabel(timeRange)}
               </p>
            </div>
          ) : (
            paginatedIncidents.map((inc) => {
              const deviceInfo = getDeviceInfo(inc.deviceId);
              const isRead = inc.leido === true;
              
              return (
                <div key={inc.id} className={`p-6 flex items-center justify-between transition-all hover:bg-white/[0.02] ${isRead ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex items-center gap-5 flex-1">
                    <div className={`p-4 rounded-2xl ${isRead ? 'bg-slate-800 text-slate-500' : 'bg-orange-500/10 text-orange-500'}`}>
                      {getTipoIcon(inc.tipo)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-white font-black text-sm uppercase italic tracking-tighter">
                          {deviceInfo.alumno_asignado}
                        </p>
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">
                          Aula: {deviceInfo.aulaId}
                        </span>
                        <span className="bg-red-500/20 px-2 py-0.5 rounded text-[8px] font-black text-red-400 uppercase tracking-tighter italic">
                          {getTipoLabel(inc.tipo)}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] font-medium leading-tight max-w-md break-all">
                        {inc.detalle || 'Acción Bloqueada'}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                         <span className="text-[9px] text-slate-600 font-black uppercase italic flex items-center gap-1 leading-none">
                           <Clock size={10} /> {formatFecha(inc.timestamp)}
                         </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {!isRead && (
                      <button 
                        onClick={() => markAsResolved(inc.id)}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black px-4 py-2 rounded-xl transition-all uppercase italic shadow-lg shadow-orange-500/20"
                      >
                        Marcar Visto
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <div className="text-center">
         <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.4em] italic">
            EDUControlPro - Security Operations Center
         </p>
      </div>

      {/* Estilos de Scrollbar Personalizados */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>
    </div>
  );
}