"use client"

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const usageData = [
  { app: "YouTube Kids", time: 186, fill: "var(--color-youtube)" },
  { app: "Kahoot!", time: 305, fill: "var(--color-kahoot)" },
  { app: "Duolingo", time: 237, fill: "var(--color-duolingo)" },
  { app: "ClassDojo", time: 73, fill: "var(--color-classdojo)" },
  { app: "Otros", time: 209, fill: "var(--color-otros)" },
]

const usageConfig = {
  time: {
    label: "Minutos",
  },
  youtube: {
    label: "YouTube Kids",
    color: "hsl(var(--chart-1))",
  },
  kahoot: {
    label: "Kahoot!",
    color: "hsl(var(--chart-2))",
  },
  duolingo: {
    label: "Duolingo",
    color: "hsl(var(--chart-3))",
  },
  classdojo: {
    label: "ClassDojo",
    color: "hsl(var(--chart-4))",
  },
  otros: {
    label: "Otros",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig

const violationsData = [
  { date: "Lunes", violations: 2 },
  { date: "Martes", violations: 3 },
  { date: "Miércoles", violations: 1 },
  { date: "Jueves", violations: 5 },
  { date: "Viernes", violations: 2 },
  { date: "Sábado", violations: 0 },
  { date: "Domingo", violations: 1 },
]

const violationsConfig = {
  violations: {
    label: "Infracciones",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig


export function ReportCharts() {
  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tiempo de Uso por Aplicación</CardTitle>
          <CardDescription>Resumen de los últimos 7 días</CardDescription>
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
                tickFormatter={(value) => value.slice(0, 15)}
              />
              <XAxis dataKey="time" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="time" radius={5} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contador de Infracciones</CardTitle>
          <CardDescription>Infracciones detectadas esta semana</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={violationsConfig} className="min-h-[200px] w-full">
            <LineChart
              accessibilityLayer
              data={violationsData}
              margin={{
                top: 5,
                right: 10,
                left: 10,
                bottom: 0,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Line
                dataKey="violations"
                type="monotone"
                stroke="var(--color-violations)"
                strokeWidth={2}
                dot={true}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
