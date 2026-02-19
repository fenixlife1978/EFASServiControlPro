'use client';
import React, { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { Users, Monitor, ShieldAlert, Clock } from 'lucide-react';

export const StatsSection = ({ institutionId }: { institutionId: string }) => {
  const [stats, setStats] = useState({
    totalAlumnos: 0,
    onlineDevices: 0,
    blockedSitesCount: 0,
    avgUsageHours: 0
  });

  useEffect(() => {
    if (!institutionId) return;

    // 1. Alumnos Totales
    const qAlumnos = query(collection(db, "usuarios"), where("InstitutoId", "==", institutionId), where("role", "==", "estudiante"));
    const unsubAlumnos = onSnapshot(qAlumnos, (s) => {
      setStats(prev => ({ ...prev, totalAlumnos: s.size }));
    });

    // 2. Dispositivos Online
    const qDevices = query(collection(db, "dispositivos"), where("InstitutoId", "==", institutionId), where("online", "==", true));
    const unsubDevices = onSnapshot(qDevices, (s) => {
      setStats(prev => ({ ...prev, onlineDevices: s.size }));
    });

    // 3. Conteo Real de Sitios Bloqueados (Alertas históricas)
    const qAlerts = query(collection(db, "alertas"), where("InstitutoId", "==", institutionId));
    const unsubAlerts = onSnapshot(qAlerts, (s) => {
      setStats(prev => ({ ...prev, blockedSitesCount: s.size }));
    });

    // 4. Promedio de Uso (Lógica inicial en 0 hasta tener logs)
    // Nota: El uso promedio requiere procesar los logs de conexión/desconexión
    setStats(prev => ({ ...prev, avgUsageHours: 0 }));

    return () => { unsubAlumnos(); unsubDevices(); unsubAlerts(); };
  }, [institutionId]);

  const cards = [
    { label: 'Alumnos', val: stats.totalAlumnos, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'En Línea', val: stats.onlineDevices, icon: Monitor, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Sitios Bloqueados', val: stats.blockedSitesCount, icon: ShieldAlert, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Uso Promedio', val: `${stats.avgUsageHours}h`, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {cards.map((c, i) => (
        <div key={i} className="bg-[#0f1117] border border-slate-800/50 p-6 rounded-[2.5rem] flex items-center gap-4 transition-all hover:border-slate-700">
          <div className={`p-4 rounded-2xl ${c.bg} ${c.color}`}>
            <c.icon size={22} />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">{c.label}</p>
            <p className="text-2xl font-black italic text-white mt-0.5">{c.val}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
