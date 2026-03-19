'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Importación corregida:
import { Tablet, User, Circle, Activity, Loader2 } from "lucide-react"; 
import { rtdb } from '@/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';

export function DirectorLiveMonitor() {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { institutionId } = useInstitution() as any;

  useEffect(() => {
    if (!institutionId) return;

    const devicesRef = ref(rtdb, 'dispositivos');

    const unsubscribe = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const sessionsArray = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(device => device.InstitutoId === institutionId);

        setActiveSessions(sessionsArray);
      } else {
        setActiveSessions([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error en Live Feed:", error);
      setLoading(false);
    });

    return () => off(devicesRef);
  }, [institutionId]);

  return (
    <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-[#0f1117] text-white p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg shadow-lg shadow-orange-500/20">
                <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Supervisión en Vivo</CardTitle>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] italic">Sede: {institutionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
            <Circle className="w-2 h-2 fill-green-500 text-green-600 animate-pulse" />
            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest leading-none">RTDB Link</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 max-h-[450px] overflow-y-auto min-h-[250px] bg-slate-50/30">
        {loading ? (
            <div className="flex flex-col items-center justify-center p-20">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase italic">Sincronizando Tablets...</p>
            </div>
        ) : activeSessions.length > 0 ? (
          activeSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-5 hover:bg-white border-b border-slate-100 last:border-0 transition-all group">
              <div className="flex items-center gap-4">
                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border-2 transition-colors ${
                  session.admin_mode_enable 
                  ? 'bg-orange-50 border-orange-100' 
                  : 'bg-white border-slate-200 group-hover:border-orange-200'
                }`}>
                  <Tablet className={`w-5 h-5 ${session.admin_mode_enable ? 'text-orange-500' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-900 uppercase italic leading-none mb-1">
                    {session.alumno_asignado || 'DISPOSITIVO SIN NOMBRE'}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded leading-none">
                      ID: {session.id}
                    </p>
                  </div>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={`text-[8px] font-black uppercase italic px-3 py-1 rounded-full border-2 transition-all ${
                  session.admin_mode_enable 
                  ? 'bg-amber-50 border-amber-200 text-amber-600' 
                  : 'bg-green-50 border-green-200 text-green-600'
                }`}
              >
                {session.admin_mode_enable ? 'Mantenimiento' : 'En Línea'}
              </Badge>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-20 text-center opacity-40">
            <SmartphoneOff className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-[10px] font-black text-slate-400 uppercase italic max-w-[180px]">
              No hay terminales activas vinculadas
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// SVG Manual para evitar el error de exportación de Lucide
function SmartphoneOff(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5l14 14"/><path d="M17 17v3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5c0-.34.08-.66.23-.94"/><path d="M11 5h4a2 2 0 0 1 2 2v7.3a2 2 0 0 1-.23.94"/></svg>
  );
}