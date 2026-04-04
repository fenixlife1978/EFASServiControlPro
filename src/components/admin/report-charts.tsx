"use client";

import React, { useEffect, useState } from 'react';
import { db, rtdb } from '@/firebase/config';
import { ref, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';
import { collection, query as fsQuery, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Loader2, BarChart3, TrendingUp, ShieldAlert, Globe, Smartphone } from "lucide-react";

// Configuración de visualización
const violationsConfig = {
  busqueda_prohibida: { label: "Búsquedas Prohibidas", color: "#f97316" },
  app_prohibida: { label: "Apps Prohibidas", color: "#ef4444" },
  configuracion_navegador: { label: "Configuración Navegador", color: "#eab308" },
  otros: { label: "Otras Infracciones", color: "#64748b" },
} satisfies ChartConfig;

const weeklyConfig = {
  violations: {
    label: "Infracciones",
    color: "#f97316",
  },
} satisfies ChartConfig;

interface ReportChartsProps {
  deviceId: string;
}

export function ReportCharts({ deviceId }: ReportChartsProps) {
  const [violationsByType, setViolationsByType] = useState<any[]>([]);
  const [weeklyViolations, setWeeklyViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);

    // Leer alertas desde RTDB (ruta correcta)
    const alertasRef = ref(rtdb, 'alertas_seguridad');
    
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        // Filtrar alertas de este dispositivo
        const alertsList = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            tipo: value.tipo || 'desconocido',
            timestamp: value.timestamp || 0,
            deviceId: value.deviceId || ''
          }))
          .filter(alert => alert.deviceId === deviceId);
        
        // 1. Procesar distribución por tipo de infracción
        const typeCount: Record<string, number> = {
          busqueda_prohibida: 0,
          app_prohibida: 0,
          configuracion_navegador: 0,
          otros: 0
        };
        
        alertsList.forEach(alert => {
          if (typeCount.hasOwnProperty(alert.tipo)) {
            typeCount[alert.tipo]++;
          } else {
            typeCount.otros++;
          }
        });
        
        const formattedByType = Object.entries(typeCount)
          .filter(([_, count]) => count > 0)
          .map(([type, count]) => ({
            type: type,
            count: count,
            fill: violationsConfig[type as keyof typeof violationsConfig]?.color || violationsConfig.otros.color
          }));
        
        setViolationsByType(formattedByType);
        
        // 2. Procesar tendencia semanal
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        const weekMap: Record<string, number> = {
          "Lun": 0, "Mar": 0, "Mié": 0, "Jue": 0, "Vie": 0, "Sáb": 0, "Dom": 0
        };
        
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        
        alertsList.forEach(alert => {
          if (alert.timestamp >= oneWeekAgo) {
            const date = new Date(alert.timestamp);
            const dayName = dayNames[date.getDay()];
            if (weekMap[dayName] !== undefined) {
              weekMap[dayName]++;
            }
          }
        });
        
        const formattedWeekly = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(day => ({
          date: day,
          violations: weekMap[day]
        }));
        
        setWeeklyViolations(formattedWeekly);
      } else {
        setViolationsByType([]);
        setWeeklyViolations([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error RTDB:", error);
      setLoading(false);
    });

    return () => off(alertasRef);
  }, [deviceId]);

  if (!deviceId) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-[#0b0d12]/50">
        <ShieldAlert className="w-8 h-8 text-slate-700 mb-2" />
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
      {/* Gráfico de Distribución por Tipo */}
      <Card className="bg-[#0f1117] border-white/5 shadow-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <BarChart3 className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-white font-black italic uppercase text-[11px] tracking-wider leading-none">
                Distribución de <span className="text-orange-500">Infracciones</span>
              </CardTitle>
              <CardDescription className="text-slate-600 text-[8px] uppercase font-bold tracking-tight mt-1">
                Por tipo de alerta
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          {violationsByType.length > 0 ? (
            <ChartContainer config={violationsConfig} className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={violationsByType} layout="vertical" margin={{ left: -10, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="type"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#475569', fontSize: 9, fontWeight: '900' }}
                    width={120}
                    tickFormatter={(value) => {
                      const config = violationsConfig[value as keyof typeof violationsConfig];
                      return config?.label || value;
                    }}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent hideLabel />}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="count" radius={6} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[9px] font-black text-slate-700 uppercase italic">
              Sin infracciones registradas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Tendencia Semanal */}
      <Card className="bg-[#0f1117] border-white/5 shadow-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-white font-black italic uppercase text-[11px] tracking-wider leading-none">
                Tendencia de <span className="text-red-500">Alertas</span>
              </CardTitle>
              <CardDescription className="text-slate-600 text-[8px] uppercase font-bold tracking-tight mt-1">
                Últimos 7 días
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <ChartContainer config={weeklyConfig} className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyViolations} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#ffffff03" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 9, fontWeight: '900' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#475569', fontSize: 9, fontWeight: '900' }}
                  allowDecimals={false}
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
  );
}
