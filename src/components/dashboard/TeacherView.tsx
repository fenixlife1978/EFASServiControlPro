'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, onSnapshot, where, doc, getDoc, limit, orderBy } from 'firebase/firestore';
import { 
  User, Globe, ShieldAlert, Clock, Activity, Monitor, 
  ExternalLink, AlertTriangle, Wifi, WifiOff 
} from 'lucide-react';

export default function TeacherView({ user }: { user: any }) {
  const [aulaInfo, setAulaInfo] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.aulaId || !user?.InstitutoId) return;

    const fetchAula = async () => {
      const docSnap = await getDoc(doc(db, `institutions/${user.InstitutoId}/Aulas`, user.aulaId));
      if (docSnap.exists()) setAulaInfo(docSnap.data());
    };
    fetchAula();

    const qAlumnos = query(
      collection(db, "usuarios"), 
      where("aulaId", "==", user.aulaId),
      where("role", "==", "estudiante")
    );
    const unsubAlumnos = onSnapshot(qAlumnos, (s) => {
      setAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qDevices = query(
      collection(db, "dispositivos"),
      where("aulaId", "==", user.aulaId)
    );
    const unsubDevices = onSnapshot(qDevices, (s) => {
      setDispositivos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qAlerts = query(
      collection(db, "alertas"),
      where("aulaId", "==", user.aulaId),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    const unsubAlerts = onSnapshot(qAlerts, (s) => {
      setAlertas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAlumnos(); unsubDevices(); unsubAlerts(); };
  }, [user]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 flex justify-between items-center shadow-2xl">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-orange-500 tracking-widest mb-2">
            <Activity size={12} /> Supervisión de Aula
          </div>
          <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter">
            {aulaInfo?.nombre_completo || 'Aula'} 
            <span className="text-slate-500 ml-3 font-light">[{aulaInfo?.grado} {aulaInfo?.seccion}]</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-500 uppercase italic">Profesor(a)</p>
          <p className="text-lg font-black text-white italic uppercase">{user?.nombre}</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3">
            <Monitor className="text-orange-500" /> Monitoreo en Vivo
          </h2>
          
          <div className="grid grid-cols-1 gap-4">
            {alumnos.map(alumno => {
              const device = dispositivos.find(d => d.id === alumno.tabletId);
              return (
                <div key={alumno.id} className="bg-[#0f1117] border border-slate-800 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${device?.online ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                        <User size={20} />
                      </div>
                      <h3 className="font-black italic text-white uppercase">{alumno.nombre}</h3>
                    </div>
                    {device?.online ? (
                      <span className="text-[8px] font-black text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 uppercase">En Línea</span>
                    ) : (
                      <span className="text-[8px] font-black text-slate-500 bg-slate-800 px-3 py-1 rounded-full uppercase">Offline</span>
                    )}
                  </div>

                  <div className="bg-black/40 rounded-2xl p-4 border border-slate-800/50 flex items-center justify-between">
                    <div className="truncate">
                      <span className="text-[8px] font-black text-orange-500 uppercase block mb-1">URL Actual:</span>
                      <p className="text-xs font-mono text-slate-300 truncate">{device?.current_url || 'Sin actividad'}</p>
                    </div>
                    <Globe size={14} className="text-slate-700 ml-4 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <h2 className="text-xl font-black italic uppercase text-white flex items-center gap-3">
            <AlertTriangle className="text-red-500" /> Infracciones
          </h2>
          <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 space-y-4">
            {alertas.length === 0 ? (
              <p className="text-center py-10 text-[10px] font-bold text-slate-600 uppercase italic">Sin incidencias</p>
            ) : (
              alertas.map((alerta, i) => (
                <div key={i} className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                  <p className="text-[10px] font-black text-white uppercase italic">{alerta.alumno_nombre}</p>
                  <p className="text-[9px] text-red-400 font-bold uppercase mt-1">Bloqueado: {alerta.url_blocked}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
