'use client';

import React, { useEffect, useState } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { Users, Monitor, ShieldAlert, Clock, TrendingUp, Wifi, AlertTriangle } from 'lucide-react';

interface Stats {
  totalAlumnos: number;
  onlineDevices: number;
  blockedSitesCount: number;
  avgUsageHours: number;
  totalDevices: number;
}

export const StatsSection = ({ institutionId }: { institutionId: string }) => {
  const [stats, setStats] = useState<Stats>({
    totalAlumnos: 0,
    onlineDevices: 0,
    blockedSitesCount: 0,
    avgUsageHours: 0,
    totalDevices: 0
  });

  const [deviceStatusMap, setDeviceStatusMap] = useState<Record<string, { lastSeen?: number, shield_mode_enable?: boolean }>>({});

  useEffect(() => {
    if (!institutionId) return;

    // 1. Alumnos Totales (Firestore - Datos Estructurales)
    const qAlumnos = query(
      collection(db, "usuarios"), 
      where("InstitutoId", "==", institutionId), 
      where("rol", "==", "alumno")
    );
    
    const unsubAlumnos = onSnapshot(qAlumnos, (snapshot) => {
      setStats(prev => ({ ...prev, totalAlumnos: snapshot.size }));
    });

    // 2. Dispositivos de la sede (Firestore para estructura)
    const qDispositivos = query(
      collection(db, "dispositivos"),
      where("InstitutoId", "==", institutionId)
    );
    
    const unsubDispositivos = onSnapshot(qDispositivos, (snapshot) => {
      setStats(prev => ({ ...prev, totalDevices: snapshot.size }));
    });

    // 3. Escuchar estado en tiempo real desde status_dispositivos (RTDB)
    const statusRef = ref(rtdb, 'status_dispositivos');
    
    const handleStatus = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const map: Record<string, { lastSeen?: number, shield_mode_enable?: boolean }> = {};
        Object.entries(data).forEach(([deviceId, info]: [string, any]) => {
          map[deviceId] = {
            lastSeen: info.lastSeen || info.ultimoAcceso,
            shield_mode_enable: info.shield_mode_enable
          };
        });
        setDeviceStatusMap(map);
        
        // Contar dispositivos online (último pulso < 45 segundos)
        const now = Date.now();
        const onlineCount = Object.values(map).filter(status => 
          status.lastSeen && (now - status.lastSeen) < 45000
        ).length;
        
        setStats(prev => ({ ...prev, onlineDevices: onlineCount }));
      } else {
        setDeviceStatusMap({});
        setStats(prev => ({ ...prev, onlineDevices: 0 }));
      }
    };
    
    onValue(statusRef, handleStatus);

    // 4. Alertas de seguridad (RTDB - alertas_seguridad)
    const alertsRef = ref(rtdb, 'alertas_seguridad');
    
    const handleAlerts = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        // Filtrar alertas de esta institución
        // Primero necesitamos saber qué dispositivos pertenecen a esta sede
        // Para eso, usamos los dispositivos de la sede
        let alertCount = 0;
        
        // Obtener IDs de dispositivos de esta sede desde Firestore
        const fetchDevicesAndCount = async () => {
          try {
            const devicesSnapshot = await query(
              collection(db, "dispositivos"),
              where("InstitutoId", "==", institutionId)
            );
            // Esto es síncrono, pero onSnapshot ya nos da los datos
            // Alternativa: usar un estado compartido
          } catch (e) {
            console.error("Error counting alerts:", e);
          }
        };
        
        // Contar alertas por deviceId (si el dispositivo pertenece a esta sede)
        // Por simplicidad, contamos todas las alertas de dispositivos que conocemos
        const deviceIds = Object.keys(deviceStatusMap);
        alertCount = Object.values(data).filter((alert: any) => 
          deviceIds.includes(alert.deviceId)
        ).length;
        
        setStats(prev => ({ ...prev, blockedSitesCount: alertCount }));
      } else {
        setStats(prev => ({ ...prev, blockedSitesCount: 0 }));
      }
    };
    
    onValue(alertsRef, handleAlerts);

    // 5. Limpieza de Listeners
    return () => { 
      unsubAlumnos(); 
      unsubDispositivos();
      off(statusRef, 'value', handleStatus);
      off(alertsRef, 'value', handleAlerts);
    };
  }, [institutionId, deviceStatusMap]);

  const cards = [
    { 
      label: 'Alumnos', 
      val: stats.totalAlumnos, 
      icon: Users, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10',
      desc: 'Registrados en sede'
    },
    { 
      label: 'En Línea', 
      val: stats.onlineDevices, 
      icon: Monitor, 
      color: 'text-emerald-500', 
      bg: 'bg-emerald-500/10',
      desc: 'Terminales activos'
    },
    { 
      label: 'Alertas SHIELD', 
      val: stats.blockedSitesCount, 
      icon: ShieldAlert, 
      color: 'text-orange-500', 
      bg: 'bg-orange-500/10',
      desc: 'Bloqueos detectados'
    },
    { 
      label: 'Dispositivos', 
      val: stats.totalDevices, 
      icon: Wifi, 
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10',
      desc: 'Terminales vinculadas'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      {cards.map((c, i) => (
        <div 
          key={i} 
          className="bg-[#0f1117] border border-white/5 p-7 rounded-[2.5rem] flex items-center gap-5 transition-all hover:bg-white/[0.02] hover:border-white/10 group relative overflow-hidden shadow-2xl"
        >
          {/* Decoración sutil de fondo */}
          <div className={`absolute -right-4 -bottom-4 opacity-5 ${c.color} group-hover:scale-125 transition-transform duration-500`}>
             <c.icon size={100} strokeWidth={1} />
          </div>

          <div className={`p-5 rounded-3xl ${c.bg} ${c.color} shadow-inner transition-all group-hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]`}>
            <c.icon size={26} strokeWidth={2.5} />
          </div>
          
          <div className="z-10">
            <div className="flex items-center gap-2">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.25em] leading-none">
                    {c.label}
                </p>
                {i === 1 && stats.onlineDevices > 0 && (
                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {i === 2 && stats.blockedSitesCount > 0 && (
                    <span className="flex h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                )}
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
                <p className="text-3xl font-black italic text-white leading-none tracking-tighter">
                    {c.val}
                </p>
                {i === 2 && stats.blockedSitesCount > 0 && (
                  <AlertTriangle size={12} className="text-orange-500" />
                )}
                {i === 1 && stats.onlineDevices > 0 && (
                  <TrendingUp size={12} className="text-emerald-500" />
                )}
            </div>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-1 italic">
                {c.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
