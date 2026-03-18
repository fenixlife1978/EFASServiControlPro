'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { db } from '@/firebase/config';
import { ref, onValue } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { 
  Globe, 
  Smartphone, 
  Calendar, 
  Loader2,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface BlockedAttempt {
  id: string;
  url: string;
  deviceId: string;
  timestamp: number;
  status: string;
}

interface DeviceInfo {
  deviceId: string;
  alumno: string;
  institutoId: string;
  institutoNombre?: string;
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
    const fetchData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = period === '7d' ? 7 : 30;
        const cutoff = now - days * 24 * 60 * 60 * 1000;

        const attemptsRef = ref(rtdb, 'system_analysis/blocked_attempts');
        const unsubscribe = onValue(attemptsRef, async (snapshot) => {
          const data = snapshot.val();
          if (!data) {
            setTopUrls([]);
            setTopDevices([]);
            setTotalAttempts(0);
            setLoading(false);
            return;
          }

          // Convertir a array y filtrar por fecha
          const allAttempts: BlockedAttempt[] = Object.entries(data).map(([key, value]: [string, any]) => ({
            id: key,
            ...value,
            timestamp: value.timestamp || 0
          })).filter(a => a.timestamp >= cutoff);

          setTotalAttempts(allAttempts.length);

          // Top URLs
          const urlCount = new Map<string, number>();
          allAttempts.forEach(a => urlCount.set(a.url, (urlCount.get(a.url) || 0) + 1));
          const sortedUrls = Array.from(urlCount.entries())
            .map(([url, count]) => ({ url, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          setTopUrls(sortedUrls);

          // Top dispositivos
          const deviceCount = new Map<string, number>();
          allAttempts.forEach(a => deviceCount.set(a.deviceId, (deviceCount.get(a.deviceId) || 0) + 1));
          const sortedDevices = Array.from(deviceCount.entries())
            .map(([deviceId, count]) => ({ deviceId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          // Enriquecer con datos de Firestore
          const enrichedDevices: DeviceInfo[] = await Promise.all(
            sortedDevices.map(async ({ deviceId, count }) => {
              const deviceDoc = await getDoc(doc(db, 'dispositivos', deviceId));
              let alumno = 'Desconocido';
              let institutoId = '';
              let aulaId = '';
              let seccion = '';

              if (deviceDoc.exists()) {
                const devData = deviceDoc.data();
                alumno = devData.alumno_asignado || 'Sin asignar';
                institutoId = devData.InstitutoId || '';
                aulaId = devData.aulaId || '';
                seccion = devData.seccion || '';
              }

              let institutoNombre = '';
              if (institutoId) {
                const instDoc = await getDoc(doc(db, 'institutions', institutoId));
                institutoNombre = instDoc.exists() ? instDoc.data().nombre : institutoId;
              }

              return { deviceId, alumno, institutoId, institutoNombre, aulaId, seccion, count };
            })
          );

          setTopDevices(enrichedDevices);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al cargar estadísticas');
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black italic uppercase text-white">
          Centro de <span className="text-orange-500">Análisis</span>
        </h2>
        <div className="flex gap-2 bg-[#1c212c] p-1 rounded-xl">
          <button
            onClick={() => setPeriod('7d')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
              period === '7d' ? 'bg-orange-500 text-white' : 'text-slate-500'
            }`}
          >
            7 días
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
              period === '30d' ? 'bg-orange-500 text-white' : 'text-slate-500'
            }`}
          >
            30 días
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <Calendar className="text-orange-500 w-5 h-5" />
          <span className="text-sm text-slate-400">
            Intentos bloqueados: <strong className="text-white text-lg">{totalAttempts}</strong>
          </span>
        </div>
      </div>

      {/* Top URLs */}
      <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <Globe className="text-red-500 w-6 h-6" />
          <h3 className="text-lg font-black italic uppercase text-white">
            Top 5 URLs <span className="text-red-500">bloqueadas</span>
          </h3>
        </div>

        {topUrls.length === 0 ? (
          <p className="text-center py-8 text-slate-500 text-[10px] uppercase">
            Sin datos en el período
          </p>
        ) : (
          <div className="space-y-4">
            {topUrls.map((item, index) => (
              <div key={item.url} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-black">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-mono text-red-400 break-all">{item.url}</span>
                    <span className="text-xs text-slate-400">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(item.count / topUrls[0].count) * 100}%` }}
                    ></div>
                  </div>
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
            Top 10 dispositivos <span className="text-blue-500">infractores</span>
          </h3>
        </div>

        {topDevices.length === 0 ? (
          <p className="text-center py-8 text-slate-500 text-[10px] uppercase">
            Sin datos en el período
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[9px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="pb-3">#</th>
                  <th className="pb-3">Dispositivo</th>
                  <th className="pb-3">Alumno</th>
                  <th className="pb-3">Sede</th>
                  <th className="pb-3">Aula</th>
                  <th className="pb-3">Sección</th>
                  <th className="pb-3 text-center">Intentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {topDevices.map((dev, index) => (
                  <tr key={dev.deviceId} className="text-xs hover:bg-slate-900/20 transition-colors">
                    <td className="py-4 font-black text-slate-400">{index + 1}</td>
                    <td className="py-4 font-mono text-[9px] text-blue-400">{dev.deviceId}</td>
                    <td className="py-4 text-slate-300">{dev.alumno}</td>
                    <td className="py-4 text-slate-400 text-[9px]">{dev.institutoNombre || dev.institutoId}</td>
                    <td className="py-4 text-slate-400">{dev.aulaId || '—'}</td>
                    <td className="py-4 text-slate-400">{dev.seccion || '—'}</td>
                    <td className="py-4 text-center">
                      <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-full text-[8px] font-black">
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
  );
}