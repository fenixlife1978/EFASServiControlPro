'use client';

import React, { useState, useEffect } from 'react';
import { rtdb, db } from '@/firebase/config';
import { ref, onValue, off, update } from 'firebase/database';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ShieldAlert, Globe, Monitor, Clock, CheckCircle, Smartphone, Shield } from 'lucide-react';

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
  const [deviceInfoMap, setDeviceInfoMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  // 1. Cargar información de dispositivos desde Firestore
  useEffect(() => {
    if (!institutionId) return;
    
    const fetchDevices = async () => {
      try {
        const devicesRef = collection(db, 'dispositivos');
        const qDevices = query(devicesRef, where('InstitutoId', '==', institutionId));
        const devicesSnap = await getDocs(qDevices);
        
        const map = new Map<string, DeviceInfo>();
        devicesSnap.forEach(docSnap => {
          const data = docSnap.data();
          map.set(docSnap.id, {
            deviceId: docSnap.id,
            alumno_asignado: data.alumno_asignado || 'Sin asignar',
            aulaId: data.aulaId || '—'
          });
        });
        setDeviceInfoMap(map);
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
        // Filtrar alertas de dispositivos de esta sede
        const alertsList: SecurityAlert[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: value.deviceId || '',
            leido: value.leido || false
          }))
          .filter(alert => deviceInfoMap.has(alert.deviceId))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setIncidents(alertsList);
      } else {
        setIncidents([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error en el log de EDUControlPro:", error);
      setLoading(false);
    });

    return () => off(alertasRef);
  }, [institutionId, deviceInfoMap]);

  // 3. Marcar alerta como leída en RTDB
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

  // 4. Función para obtener el ícono según el tipo de alerta
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

  // 5. Función para obtener el label del tipo de alerta
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

  const pendingCount = incidents.filter(i => !i.leido).length;

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
        <div className="p-8 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-3">
              <ShieldAlert className="text-orange-500" size={24} /> Log de Incidencias Global
            </h2>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">
              Historial de infracciones y bloqueos detectados por Centinela - EDUControlPro
            </p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl">
             <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest italic">
                {pendingCount} Pendientes
             </span>
          </div>
        </div>

        {/* Listado */}
        <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
          {incidents.length === 0 ? (
            <div className="p-20 text-center opacity-30 italic">
               <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
               <p className="text-xs font-black uppercase tracking-widest">Sin infracciones registradas</p>
            </div>
          ) : (
            incidents.map((inc) => {
              const deviceInfo = getDeviceInfo(inc.deviceId);
              const isRead = inc.leido === true;
              
              return (
                <div key={inc.id} className={`p-6 flex items-center justify-between transition-all hover:bg-white/[0.02] ${isRead ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${isRead ? 'bg-slate-800 text-slate-500' : 'bg-orange-500/10 text-orange-500'}`}>
                      {getTipoIcon(inc.tipo)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
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
    </div>
  );
}
