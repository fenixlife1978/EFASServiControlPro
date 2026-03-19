'use client';

import React, { useState, useEffect } from 'react';
import { rtdb, db } from '@/firebase/config';
import { ref, onValue, query, orderByChild, startAt } from 'firebase/database';
import { 
  collection, 
  query as fsQuery, 
  where, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { 
  Globe, 
  Smartphone, 
  Calendar, 
  Loader2,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

interface BlockedAttempt {
  id: string;
  url: string;
  deviceId: string;
  timestamp: number;
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
  const [topUrls, setTopUrls] = useState<{ url: string; count: number }[]>([]);
  const [topDevices, setTopDevices] = useState<DeviceInfo[]>([]);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    if (!institutionId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = period === '7d' ? 7 : 30;
        const cutoff = now - days * 24 * 60 * 60 * 1000;

        // 1. Obtener primero los dispositivos de esta sede específica (Optimización Multi-tenant)
        const devicesRef = collection(db, 'dispositivos');
        const qDevices = fsQuery(devicesRef, where('InstitutoId', '==', institutionId));
        const devicesSnap = await getDocs(qDevices);
        
        const validDevicesMap = new Map();
        devicesSnap.forEach(docSnap => {
          validDevicesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });

        // 2. Escuchar Realtime Database con filtro de tiempo
        const attemptsRef = ref(rtdb, 'system_analysis/blocked_attempts');
        const recentQuery = query(attemptsRef, orderByChild('timestamp'), startAt(cutoff));

        const unsubscribe = onValue(recentQuery, (snapshot) => {
          const data = snapshot.val();
          
          if (!data) {
            setTopUrls([]);
            setTopDevices([]);
            setTotalAttempts(0);
            setLoading(false);
            return;
          }

          // 3. Filtrar logs que pertenecen solo a los dispositivos de esta sede
          const allAttempts: BlockedAttempt[] = Object.entries(data)
            .map(([key, value]: [string, any]) => ({
              id: key,
              url: value.url,
              deviceId: value.deviceId,
              timestamp: value.timestamp || 0
            }))
            .filter(attempt => validDevicesMap.has(attempt.deviceId));

          setTotalAttempts(allAttempts.length);

          // 4. Procesar Top URLs Bloqueadas
          const urlCount = new Map<string, number>();
          allAttempts.forEach(a => urlCount.set(a.url, (urlCount.get(a.url) || 0) + 1));
          
          const sortedUrls = Array.from(urlCount.entries())
            .map(([url, count]) => ({ url, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          setTopUrls(sortedUrls);

          // 5. Procesar Top Dispositivos Infractores
          const deviceStats = new Map<string, number>();
          allAttempts.forEach(a => deviceStats.set(a.deviceId, (deviceStats.get(a.deviceId) || 0) + 1));

          const sortedDevices = Array.from(deviceStats.entries())
            .map(([deviceId, count]) => {
              const devData = validDevicesMap.get(deviceId);
              return {
                deviceId,
                alumno: devData?.alumno_asignado || 'Sin asignar',
                institutoId: devData?.InstitutoId || institutionId,
                aulaId: devData?.aulaId || '—',
                seccion: devData?.seccion || '—',
                count
              };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          setTopDevices(sortedDevices);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error en Analytics:', error);
        toast.error('Error al sincronizar datos de seguridad');
        setLoading(false);
      }
    };

    fetchData();
  }, [period, institutionId]);

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
        <h2 className="text-2xl font-black italic uppercase text-white">
          Centro de <span className="text-orange-500">Análisis</span>
        </h2>
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
          </div>
        </div>
        <TrendingUp className="text-emerald-500 w-8 h-8 opacity-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top URLs */}
        <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <Globe className="text-red-500 w-6 h-6" />
            <h3 className="text-lg font-black italic uppercase text-white">
              URLs más <span className="text-red-500">reincidentes</span>
            </h3>
          </div>

          {topUrls.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-600">
              <ShieldAlert className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-[10px] uppercase font-black">Sin infracciones detectadas</p>
            </div>
          ) : (
            <div className="space-y-6">
              {topUrls.map((item, index) => (
                <div key={item.url} className="group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-slate-300 group-hover:text-red-400 transition-colors">
                      {item.url}
                    </span>
                    <span className="text-[10px] font-black text-white bg-white/5 px-2 py-1 rounded-md">
                      {item.count}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-red-600 to-orange-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${(item.count / topUrls[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Dispositivos */}
        <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <Smartphone className="text-blue-500 w-6 h-6" />
            <h3 className="text-lg font-black italic uppercase text-white">
              Dispositivos <span className="text-blue-500">infractores</span>
            </h3>
          </div>

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
                      <p className="text-[9px] font-mono text-slate-500">{dev.deviceId}</p>
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
        </div>
      </div>
    </div>
  );
}