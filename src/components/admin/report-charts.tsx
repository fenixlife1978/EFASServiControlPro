"use client"

import React, { useEffect, useState } from 'react'
import { db, rtdb } from '@/firebase/config' // Importamos ambos
import { ref, onValue } from 'firebase/database'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// Configuración de colores corporativos EDUControlPro
const usageConfig = {
  time: { label: "Minutos" },
  youtube: { label: "YouTube Kids", color: "#ff0000" },
  kahoot: { label: "Kahoot!", color: "#4617b4" },
  duolingo: { label: "Duolingo", color: "#58cc02" },
  otros: { label: "Otros", color: "#64748b" },
} satisfies ChartConfig

const violationsConfig = {
  violations: {
    label: "Infracciones",
    color: "#f97316", // Naranja EDUControlPro
  },
} satisfies ChartConfig

interface ReportChartsProps {
  tabletId: string;
}

export function ReportCharts({ tabletId }: ReportChartsProps) {
  const [usageData, setUsageData] = useState<any[]>([]);
  const [violationsData, setViolationsData] = useState<any[]>([]);

  useEffect(() => {
    if (!tabletId) return;

    // 1. HÍBRIDO - REALTIME DATABASE: Tiempo de uso actual
    // Escuchamos la rama de estadísticas de la tablet
    const usageRef = ref(rtdb, `stats/${tabletId}/apps_usage`);
    const unsubscribeUsage = onValue(usageRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedData = Object.entries(data).map(([key, value]: any) => ({
          app: key,
          time: value.minutes || 0,
          fill: `var(--color-${key.toLowerCase()})`
        }));
        setUsageData(formattedData);
      }
    });

    // 2. HÍBRIDO - FIRESTORE: Contador de infracciones histórico
    const q = query(
      collection(db, "alertas"),
      where("deviceId", "==", tabletId),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribeAlerts = onSnapshot(q, (snapshot) => {
      // Agrupamos por día para el gráfico de líneas
      const days: Record<string, number> = {
        "Lun": 0, "Mar": 0, "Mie": 0, "Jue": 0, "Vie": 0, "Sab": 0, "Dom": 0
      };
      
      const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
      
      snapshot.docs.forEach(doc => {
        const date = doc.data().timestamp?.toDate();
        if (date) {
          const dayName = dayNames[date.getDay()];
          days[dayName]++;
        }
      });

      const formattedViolations = Object.entries(days).map(([date, count]) => ({
        date,
        violations: count
      }));
      
      setViolationsData(formattedViolations);
    });

    return () => {
      unsubscribeUsage();
      unsubscribeAlerts();
    };
  }, [tabletId]);

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      {/* Gráfico de Barras - Realtime Data */}
      <Card className="bg-[#0f1117] border-white/5 shadow-2xl rounded-[2rem]">
        <CardHeader>
          <CardTitle className="text-white font-black italic uppercase text-sm tracking-tighter">
            Distribución de <span className="text-orange-500">Uso</span>
          </CardTitle>
          <CardDescription className="text-slate-500 text-[10px] uppercase font-bold">
            Monitorización en vivo (RTDB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={usageConfig} className="min-h-[200px] w-full">
            <BarChart accessibilityLayer data={usageData} layout="vertical" margin={{ left: 10 }}>
              <YAxis
                dataKey="app"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
              />
              <XAxis dataKey="time" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="time" radius={8} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Líneas - Firestore Data */}
      <Card className="bg-[#0f1117] border-white/5 shadow-2xl rounded-[2rem]">
        <CardHeader>
          <CardTitle className="text-white font-black italic uppercase text-sm tracking-tighter">
            Frecuencia de <span className="text-red-500">Alertas</span>
          </CardTitle>
          <CardDescription className="text-slate-500 text-[10px] uppercase font-bold">
            Histórico semanal (Firestore)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={violationsConfig} className="min-h-[200px] w-full">
            <LineChart
              accessibilityLayer
              data={violationsData}
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Line
                dataKey="violations"
                type="monotone"
                stroke="#f97316"
                strokeWidth={3}
                dot={{ r: 4, fill: '#f97316', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#fff' }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
