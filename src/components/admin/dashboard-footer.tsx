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

const chartData = [
  { name: "Screen Time", value: 250, fill: "var(--color-chart-1)" },
  { name: "Locah Time", value: 187, fill: "var(--color-chart-2)" },
];

const chartConfig = {
  value: {
    label: "Incidencias",
  },
  "Screen Time": {
    label: "Screen Time",
    color: "hsl(var(--chart-1))",
  },
  "Locah Time": {
    label: "Locah Time",
    color: "hsl(var(--chart-2))",
  },
};

export function DashboardFooter() {
  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar alumno..." className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
                <AdminUserNav />
                <Button>
                    <Plus />
                    Añadir Alumno
                </Button>
            </div>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="font-bold text-2xl">Total Alumnos: 250</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Checkbox id="web-app" defaultChecked />
                <Label htmlFor="web-app">Web/App</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="aulas" />
                <Label htmlFor="aulas">Aulas Monitoreadas: 15</Label>
              </div>
            </div>
            <div className="font-semibold pt-2 border-t">Incidencias Hoy: 35</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Distribución de Incidencias</CardTitle>
            <CardDescription>Análisis de las incidencias del día</CardDescription>
          </CardHeader>
          <CardContent>
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
                    innerRadius={60}
                    strokeWidth={5}
                />
            </PieChart>
           </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
