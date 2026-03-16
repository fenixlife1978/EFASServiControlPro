'use client';
import React, { useEffect, useState } from 'react';
import { db, rtdb } from '@/firebase/config'; // Importamos rtdb
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database'; // Métodos de RTDB
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

    // 1. Alumnos Totales (Se mantiene en FIRESTORE - Cambio poco frecuente)
    const qAlumnos = query(
      collection(db, "usuarios"), 
      where("InstitutoId", "==", institutionId), 
      where("role", "==", "estudiante")
    );
    const unsubAlumnos = onSnapshot(qAlumnos, (s) => {
      setStats(prev => ({ ...prev, totalAlumnos: s.size }));
    });

    // 2. Dispositivos Online (MIGRADO A RTDB)
    // Escuchamos el nodo global de dispositivos y filtramos por sede y estado
    const devicesRef = ref(rtdb, 'dispositivos');
    const unsubDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const count = Object.values(data).filter((d: any) => 
          d.InstitutoId === institutionId && d.online === true
        ).length;
        setStats(prev => ({ ...prev, onlineDevices: count }));
      } else {
        setStats(prev => ({ ...prev, onlineDevices: 0 }));
      }
    });

    // 3. Conteo de Sitios Bloqueados / Alertas (MIGRADO A RTDB)
    // Buscamos en el nodo de alertas específico de la institución
    const alertsRef = ref(rtdb, `alertas/${institutionId}`);
    const unsubAlerts = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Si las alertas están organizadas por ID de dispositivo dentro de la sede
        const totalAlerts = Object.keys(data).length; 
        setStats(prev => ({ ...prev, blockedSitesCount: totalAlerts }));
      } else {
        setStats(prev => ({ ...prev, blockedSitesCount: 0 }));
      }
    });

    // 4. Promedio de Uso (Lógica para futura implementación)
    setStats(prev => ({ ...prev, avgUsageHours: 0 }));

    return () => { 
      unsubAlumnos(); 
      unsubDevices(); // onValue no devuelve una función de desuscripción directa como onSnapshot en v9+, 
                      // pero Firebase gestiona las referencias. Para ser estrictos:
      // off(devicesRef); off(alertsRef); si usaras la sintaxis antigua.
    };
  }, [institutionId]);

  const cards = [
    { label: 'Alumnos', val: stats.totalAlumnos, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'En Línea', val: stats.onlineDevices, icon: Monitor, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Alertas SHIELD', val: stats.blockedSitesCount, icon: ShieldAlert, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Uso Promedio', val: `${stats.avgUsageHours}h`, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {cards.map((c, i) => (
        <div key={i} className="bg-[#0f1117] border border-slate-800/50 p-6 rounded-[2.5rem] flex items-center gap-4 transition-all hover:border-blue-500/20 group">
          <div className={`p-4 rounded-2xl ${c.bg} ${c.color} group-hover:scale-110 transition-transform`}>
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
