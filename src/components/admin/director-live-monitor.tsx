'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tablet, User, Circle } from "lucide-react";

export function DirectorLiveMonitor() {
  const activeSessions = [
    { id: 'S-1', usuario: 'Alumno: Marcos Díaz', dispositivo: 'TAB-08', status: 'online' },
    { id: 'S-2', usuario: 'Prof. Ana Silva', dispositivo: 'TAB-02', status: 'online' },
    { id: 'S-3', usuario: 'Alumno: Luis Mora', dispositivo: 'TAB-15', status: 'idle' },
  ];

  return (
    <Card className="border-slate-200 shadow-xl rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 text-white p-6">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Terminales en Línea</CardTitle>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest italic">Live Feed</p>
          </div>
          <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
            <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
            <span className="text-[10px] font-black text-green-500 uppercase">Activo</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {activeSessions.map((session) => (
          <div key={session.id} className="flex items-center justify-between p-4 hover:bg-slate-50 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                {session.usuario.includes('Prof') ? <User className="w-5 h-5 text-slate-600" /> : <Tablet className="w-5 h-5 text-slate-600" />}
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 uppercase italic">{session.usuario}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">ID: {session.dispositivo}</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[8px] font-black uppercase ${session.status === 'online' ? 'border-green-200 text-green-600' : 'border-amber-200 text-amber-600'}`}>
              {session.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
