'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tablet, User, Circle, Activity } from "lucide-react";
import { rtdb } from '@/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';

export function DirectorLiveMonitor() {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { institutionId } = useInstitution() as any;

  useEffect(() => {
    if (!institutionId) return;

    // Referencia al nodo de monitoreo en vivo en RTDB
    const liveRef = ref(rtdb, `monitoreo/${institutionId}/live`);

    // Listener en tiempo real
    onValue(liveRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convertimos el objeto de RTDB en un array para el mapa
        const sessionsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setActiveSessions(sessionsArray);
      } else {
        setActiveSessions([]);
      }
      setLoading(false);
    });

    // Limpieza del listener al desmontar el componente
    return () => off(liveRef);
  }, [institutionId]);

  return (
    <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-[#0f1117] text-white p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg">
                <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Terminales en Línea</CardTitle>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] italic">EDUControlPro Live Feed</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
            <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Streaming</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 max-h-[450px] overflow-y-auto">
        {loading ? (
            <div className="p-10 text-center">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase italic">Sincronizando RTDB...</p>
            </div>
        ) : activeSessions.length > 0 ? (
          activeSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border-2 ${session.tipo === 'profesor' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                  {session.tipo === 'profesor' ? (
                    <User className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Tablet className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-900 uppercase italic leading-none mb-1">
                    {session.usuario || 'Usuario Desconocido'}
                  </p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 self-start px-1.5 py-0.5 rounded">
                    ID: {session.dispositivo || 'N/A'}
                  </p>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={`text-[8px] font-black uppercase italic px-3 py-1 rounded-full border-2 ${
                  session.status === 'online' 
                  ? 'bg-green-50 border-green-200 text-green-600' 
                  : 'bg-amber-50 border-amber-200 text-amber-600'
                }`}
              >
                {session.status || 'offline'}
              </Badge>
            </div>
          ))
        ) : (
          <div className="p-12 text-center">
            <p className="text-[10px] font-black text-slate-300 uppercase italic">No hay terminales activas en este momento</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
