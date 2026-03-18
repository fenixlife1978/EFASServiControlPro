'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Tablet, GraduationCap, Activity } from "lucide-react";

export function DirectorOverview() {
  const stats = [
    { title: "Profesores", value: "12", icon: Users, color: "text-blue-500" },
    { title: "Alumnos", value: "148", icon: GraduationCap, color: "text-orange-500" },
    { title: "Tablets Activas", value: "32", icon: Tablet, color: "text-green-500" },
    { title: "Actividad Red", value: "94%", icon: Activity, color: "text-purple-500" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border-slate-200 shadow-sm overflow-hidden group hover:border-orange-500/50 transition-all bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-slate-900">{stat.value}</div>
          </CardContent>
          <div className="h-1 w-full bg-slate-100">
            <div className="h-full bg-orange-500 w-2/3 group-hover:w-full transition-all duration-500" />
          </div>
        </Card>
      ))}
    </div>
  );
}
