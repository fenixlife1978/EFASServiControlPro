'use client';

import React, { useEffect, useState } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { Users, Monitor, ShieldAlert, Clock, TrendingUp } from 'lucide-react';

interface Stats {
  totalAlumnos: number;
  onlineDevices: number;
  blockedSitesCount: number;
  avgUsageHours: number;
}

export const StatsSection = ({ institutionId }: { institutionId: string }) => {
  const [stats, setStats] = useState<Stats>({
    totalAlumnos: 0,
    onlineDevices: 0,
    blockedSitesCount: 0,
    avgUsageHours: 0
  });

  useEffect(() => {
    if (!institutionId) return;

    // 1. Alumnos Totales (Firestore - Datos Estructurales)
    const qAlumnos = query(
      collection(db, "usuarios"), 
      where("InstitutoId", "==", institutionId), 
      where("rol", "==", "alumno") // Corregido a 'rol' según estándar EFAS
    );
    
    const unsubAlumnos = onSnapshot(qAlumnos, (snapshot) => {
      setStats(prev => ({ ...prev, totalAlumnos: snapshot.size }));
    });

    // 2. Dispositivos Online (RTDB - Pulso en Tiempo Real)
    const devicesRef = ref(rtdb, 'dispositivos');
    const handleDevices = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const count = Object.values(data).filter((d: any) => 
          d.InstitutoId === institutionId && d.online === true
        ).length;
        setStats(prev => ({ ...prev, onlineDevices: count }));
      } else {
        setStats(prev => ({ ...prev, onlineDevices: 0 }));
      }
    };
    onValue(devicesRef, handleDevices);

    // 3. Sistema SHIELD: Alertas Críticas (RTDB)
    const alertsRef = ref(rtdb, `alertas/${institutionId}`);
    const handleAlerts = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        // Contamos las claves (IDs de incidentes) bajo la sede
        const totalAlerts = Object.keys(data).length; 
        setStats(prev => ({ ...prev, blockedSitesCount: totalAlerts }));
      } else {
        setStats(prev => ({ ...prev, blockedSitesCount: 0 }));
      }
    };
    onValue(alertsRef, handleAlerts);

    // 4. Limpieza de Listeners (Evita fugas de memoria y cargos extra en Firebase)
    return () => { 
      unsubAlumnos(); 
      off(devicesRef, 'value', handleDevices);
      off(alertsRef, 'value', handleAlerts);
    };
  }, [institutionId]);

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
      desc: 'Bloqueos hoy'
    },
    { 
      label: 'Uso Promedio', 
      val: `${stats.avgUsageHours}h`, 
      icon: Clock, 
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10',
      desc: 'Sesión diaria'
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
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
                <p className="text-3xl font-black italic text-white leading-none tracking-tighter">
                    {c.val}
                </p>
                <TrendingUp size={12} className="text-slate-700 opacity-50" />
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
