'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { Lock, ShieldAlert } from 'lucide-react';

export default function LockListener() {
  const [isLocked, setIsLocked] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Recuperamos el ID vinculado con el QR desde el localStorage
    const savedId = localStorage.getItem('EDU_Device_ID');
    if (savedId) setDeviceId(savedId);
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    // Escuchamos directamente el documento del dispositivo vinculado en EDUControlPro
    const unsub = onSnapshot(doc(db, "usuarios", deviceId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Bloqueo estricto si la propiedad bloqueado es true
        setIsLocked(data.bloqueado === true);
      }
    }, (err) => {
      console.error("Error en el monitor de bloqueo EDUControlPro:", err);
    });

    return () => unsub();
  }, [deviceId]);

  // Si no está bloqueado, no renderizamos nada
  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-[#0f1117] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* Luces de fondo de advertencia */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 blur-[120px] -z-10" />
      
      <div className="bg-red-500/10 border-2 border-red-500/50 p-10 rounded-[3rem] backdrop-blur-xl mb-8 shadow-2xl shadow-red-500/20">
        <Lock size={100} className="text-red-500 animate-pulse" />
      </div>

      <div className="space-y-2">
        <h1 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter">
          ACCESO <span className="text-red-500">RESTRINGIDO</span>
        </h1>
        
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="h-[1px] w-12 bg-slate-800" />
          <ShieldAlert size={14} className="text-red-500" />
          <div className="h-[1px] w-12 bg-slate-800" />
        </div>

        <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em] mt-4">
          SISTEMA DE CONTROL EDUCONTROLPRO
        </p>
        
        <p className="text-slate-600 text-[9px] font-bold uppercase mt-12 max-w-xs mx-auto leading-relaxed">
          ESTE DISPOSITIVO HA SIDO BLOQUEADO POR EL ADMINISTRADOR DEL INSTITUTO. 
          POR FAVOR, CONTACTA CON TU PROFESOR.
        </p>
      </div>

      {/* Identificador de seguridad en la esquina */}
      <div className="absolute bottom-10 text-[8px] font-mono text-slate-700 uppercase tracking-widest">
        Device Auth ID: {deviceId?.slice(0, 8)}...
      </div>
    </div>
  );
}
