"use client"

import React, { useEffect, useState } from 'react'
import { db, rtdb } from '@/firebase/config'
import { ref, onValue, off } from 'firebase/database'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Loader2, BarChart3, TrendingUp } from "lucide-react"

// Configuración de visualización para EDUControlPro
const usageConfig = {
  youtube: { label: "YouTube Kids", color: "#ff0000" },
  kahoot: { label: "Kahoot!", color: "#4617b4" },
  duolingo: { label: "Duolingo", color: "#58cc02" },
  otros: { label: "Otros", color: "#64748b" },
} satisfies ChartConfig

const violationsConfig = {
  violations: {
    label: "Infracciones",
    color: "#f97316",
  },
} satisfies ChartConfig

interface ReportChartsProps {
  deviceId: string;
}

export function ReportCharts({ deviceId }: ReportChartsProps) {
  const [usageData, setUsageData] = useState<any[]>([]);
  const [violationsData, setViolationsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);

    // 1. RTDB: Uso de Apps (Alta frecuencia - Optimización de Cuota)
    const usageRef = ref(rtdb, `stats/${deviceId}/apps_usage`);
    
    const unsubscribeUsage = onValue(usageRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedData = Object.entries(data).map(([key, value]: any) => {
          const appKey = key.toLowerCase() as keyof typeof usageConfig;
          
          // Solución al Error 2339: Casting seguro para obtener el color
          const configEntry = usageConfig[appKey] as { label: string; color?: string } | undefined; 
          const color = configEntry?.color || usageConfig.otros.color;
          const label = configEntry?.label || key;

          return {
            app: label,
            time: value.minutes || 0,
            fill: color
          };
        });
        setUsageData(formattedData);
      } else {
        setUsageData([]);
      }
    });

    // 2. FIRESTORE: Historial de Alertas (Baja frecuencia - Persistencia)
    const q = query(
      collection(db, "alertas"),
      where("deviceId", "==", deviceId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribeAlerts = onSnapshot(q, (snapshot) => {
      const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
      const daysCount: Record<string, number> = { "Lun": 0, "Mar": 0, "Mie": 0, "Jue": 0, "Vie": 0, "Sab": 0, "Dom": 0 };

      snapshot.docs.forEach(doc => {
        const ts = doc.data().timestamp;
        // Manejo de timestamp de Firestore
        const date = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
        if (date) {
          const dayName = dayNames[date.getDay()];
          if (daysCount[dayName] !== undefined) daysCount[dayName]++;
        }
      });

      // Aseguramos el orden cronológico de la semana en el gráfico
      const formattedViolations = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map(date => ({
        date,
        violations: daysCount[date]
      }));
      
      setViolationsData(formattedViolations);
      setLoading(false);
    }, (error) => {
      console.error("Error Firestore:", error);
      setLoading(false);
    });

    return () => {
      off(usageRef);
      unsubscribeAlerts();
    };
  }, [deviceId]);

  if (!deviceId) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-[#0b0d12]/50">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Esperando Selección de Terminal</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center gap-4 bg-[#0f1117] rounded-[2rem] border border-white/5 shadow-2xl">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest leading-none animate-pulse">
          Sincronizando Inteligencia EFAS...
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      {/* Gráfico de Uso (RTDB) */}
      <Card className="bg-[#0f1117] border-white/5 shadow-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <BarChart3 className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-white font-black italic uppercase text-[11px] tracking-wider leading-none">
                Distribución de <span className="text-orange-500">Uso Diario</span>
              </CardTitle>
              <CardDescription className="text-slate-600 text-[8px] uppercase font-bold tracking-tight mt-1">
                Tiempo en pantalla por aplicación
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          {usageData.length > 0 ? (
            <ChartContainer config={usageConfig} className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageData} layout="vertical" margin={{ left: -10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="app"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#475569', fontSize: 9, fontWeight: '900' }}
                    width={80}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="time" radius={6} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[9px] font-black text-slate-700 uppercase italic">
              Sin registros de actividad hoy
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Alertas (Firestore) */}
      <Card className="bg-[#0f1117] border-white/5 shadow-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-white font-black italic uppercase text-[11px] tracking-wider leading-none">
                Tendencia de <span className="text-red-500">Alertas Críticas</span>
              </CardTitle>
              <CardDescription className="text-slate-600 text-[8px] uppercase font-bold tracking-tight mt-1">
                Frecuencia de infracciones semanal
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <ChartContainer config={violationsConfig} className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={violationsData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#ffffff03" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 9, fontWeight: '900' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="violations"
                  type="monotone"
                  stroke="#f97316"
                  strokeWidth={4}
                  dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#fff', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
