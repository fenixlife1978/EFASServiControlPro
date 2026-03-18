'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Pie, PieChart } from "recharts";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Plus, Search } from "lucide-react";
import { AdminUserNav } from "../common/admin-user-nav";

// Datos corregidos para EDUControlPro
const chartData = [
  { name: "Screen Time", value: 250, fill: "var(--color-chart-1)" },
  { name: "Local Time", value: 187, fill: "var(--color-chart-2)" }, // Corregido de 'Locah'
];

const chartConfig = {
  value: {
    label: "Incidencias",
  },
  "Screen Time": {
    label: "Tiempo de Pantalla",
    color: "hsl(var(--chart-1))",
  },
  "Local Time": {
    label: "Tiempo Local",
    color: "hsl(var(--chart-2))",
  },
};

export function DashboardFooter() {
  return (
    <div className="space-y-6">
        {/* Barra de Herramientas Superior */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0f1117]/50 p-4 rounded-[2rem] border border-slate-800/50 backdrop-blur-sm">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="BUSCAR ESTUDIANTE..." 
                  className="pl-9 bg-slate-950 border-slate-800 text-[10px] font-black uppercase italic rounded-xl focus:border-orange-500 transition-all" 
                />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <AdminUserNav />
                <Button className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase italic px-6 shadow-lg shadow-orange-500/20">
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir Alumno
                </Button>
            </div>
        </div>

      {/* Grid de Reportes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 bg-[#0f1117] border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-slate-800/50 bg-slate-900/20">
            <CardTitle className="text-sm font-black text-white uppercase italic tracking-widest">Resumen General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
               <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Población Estudiantil</p>
               <div className="font-black text-4xl text-white italic tracking-tighter">250 <span className="text-xs text-orange-500 uppercase">Alumnos</span></div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-2xl border border-slate-800/50">
                <Checkbox id="web-app" defaultChecked className="border-orange-500 data-[state=checked]:bg-orange-500" />
                <Label htmlFor="web-app" className="text-[10px] font-black text-slate-300 uppercase cursor-pointer">Estado: EDUControlPro Web/App</Label>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-2xl border border-slate-800/50">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <Label htmlFor="aulas" className="text-[10px] font-black text-slate-300 uppercase">Aulas Monitoreadas: 15</Label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Incidencias Hoy</span>
                  <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-[10px] font-black italic">35 DETECTADAS</span>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 bg-[#0f1117] border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-slate-800/50 bg-slate-900/20">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-sm font-black text-white uppercase italic tracking-widest">Distribución de Incidencias</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-500 mt-1">Análisis preventivo del día actual</CardDescription>
              </div>
              <div className="text-[10px] font-black text-orange-500 italic">EDUControlPro Insights</div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[250px]"
          >
            <PieChart>
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    strokeWidth={8}
                    stroke="#0f1117"
                />
            </PieChart>
           </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
