'use client';
import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config'; 
import { ref, query, orderByChild, equalTo, onValue, update } from 'firebase/database';
import { useInstitution } from '../institution-context';
import { Radio, Tablet, Globe, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DispositivosPage() {
  const { institutionId } = useInstitution();
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    const dbRef = ref(rtdb, 'dispositivos');
    const q = query(dbRef, orderByChild('InstitutoId'), equalTo(institutionId));

    const unsub = onValue(q, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDispositivos(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setDispositivos([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [institutionId]);

  // FUNCIÓN PARA CAMBIAR EL MODO TÉCNICO EN RTDB
  const toggleTechMode = async (deviceId: string, currentStatus: boolean) => {
    try {
      const deviceRef = ref(rtdb, `dispositivos/${deviceId}`);
      await update(deviceRef, {
        admin_mode_enable: !currentStatus
      });
      // La actualización visual es automática gracias a onValue
    } catch (error) {
      console.error("Error al cambiar modo técnico:", error);
    }
  };

  const getStatus = (lastPulse: number) => {
    if (!lastPulse) return { label: 'Sin Datos', color: 'bg-slate-300', pulse: false };
    const diff = now - lastPulse;
    if (diff < 45000) return { label: 'En Línea', color: 'bg-green-500', pulse: true };
    if (diff < 90000) return { label: 'Inactivo', color: 'bg-orange-400', pulse: false };
    return { label: 'Desconectado', color: 'bg-red-500', pulse: false };
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <button 
        onClick={() => router.back()}
        className="mb-8 flex items-center gap-3 text-slate-400 hover:text-orange-500 font-black uppercase text-[10px] tracking-widest transition-all group"
      >
        <span className="bg-white h-10 w-10 flex items-center justify-center rounded-full shadow-sm group-hover:shadow-orange-200 group-hover:scale-110 transition-all text-lg font-bold italic">←</span>
        Volver al Panel
      </button>

      <header className="mb-12">
        <h1 className="text-5xl font-black italic uppercase text-slate-900 tracking-tighter leading-none">
          Mando de <span className="text-orange-500 text-6xl block sm:inline">Unidades</span>
        </h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-4 italic flex items-center gap-2">
          <Activity className="w-3 h-3 text-orange-500" /> Sincronización Directa vía RTDB
        </p>
      </header>

      {loading ? (
        <div className="font-black italic text-slate-300 uppercase animate-pulse">Cargando Hardware...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {dispositivos.map((disp) => {
            const status = getStatus(disp.ultimoHeartbeat);
            const isTechMode = disp.admin_mode_enable || false;

            return (
              <div key={disp.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm transition-all hover:border-orange-200 group relative">
                
                {/* Header Tarjeta */}
                <div className="flex justify-between items-start mb-8">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner transition-colors ${isTechMode ? 'bg-orange-500 text-white shadow-orange-200' : 'bg-slate-900 text-white'}`}>
                    <Tablet className="w-8 h-8" />
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                      {status.pulse && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                      <span className={`text-[11px] font-black uppercase italic ${status.color.replace('bg-', 'text-')}`}>
                        {status.label}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none italic">ID: {disp.id.slice(-8)}</span>
                  </div>
                </div>

                {/* Info Alumno */}
                <div className="mb-6">
                  <h3 className="text-2xl font-black italic uppercase text-slate-800 leading-tight">
                    {disp.nombre_estudiante || "Equipo Remoto"}
                  </h3>
                </div>

                {/* Navegación (Bento Interno) */}
                <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 mb-8 group-hover:bg-orange-50/30 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-3 h-3 text-orange-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400 italic">Link Activo</span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 truncate italic">
                    {disp.url_actual || 'Sin actividad detectada'}
                  </p>
                </div>

                {/* CONTROL: SWITCH MODO TÉCNICO */}
                <div className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between ${isTechMode ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    {isTechMode ? <ShieldCheck className="w-5 h-5 text-orange-500" /> : <ShieldAlert className="w-5 h-5 text-slate-300" />}
                    <span className={`text-[10px] font-black uppercase italic ${isTechMode ? 'text-orange-600' : 'text-slate-400'}`}>
                      {isTechMode ? 'Acceso Liberado' : 'Filtro Activo'}
                    </span>
                  </div>
                  
                  {/* Switch Estilizado */}
                  <button
                    onClick={() => toggleTechMode(disp.id, isTechMode)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors relative ${isTechMode ? 'bg-orange-500' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-300 transform ${isTechMode ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
