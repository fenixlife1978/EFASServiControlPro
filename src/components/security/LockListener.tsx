'use client';

import { useEffect, useState } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, off } from 'firebase/database';
import { Lock, ShieldAlert, Smartphone } from 'lucide-react';

export default function LockListener() {
  const [isLocked, setIsLocked] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isTechMode, setIsTechMode] = useState(false);

  useEffect(() => {
    // Recuperamos el ID vinculado con el QR desde el localStorage
    const savedId = localStorage.getItem('efas_device_id') || localStorage.getItem('deviceId');
    if (savedId) setDeviceId(savedId);
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    // 1. Escuchar el estado del dispositivo desde RTDB (status_dispositivos)
    const statusRef = ref(rtdb, `status_dispositivos/${deviceId}`);
    
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Modo blindado activado = bloqueado
        // Si modo técnico está activado, anula el bloqueo
        const blocked = data.shield_mode_enable === true;
        const techMode = data.admin_mode_enable === true;
        
        setIsLocked(blocked && !techMode);
        setIsTechMode(techMode);
      } else {
        // Si no hay status, verificar en dispositivos
        const deviceRef = ref(rtdb, `dispositivos/${deviceId}`);
        const unsubscribeDevice = onValue(deviceRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const blocked = data.shield_mode_enable === true;
            const techMode = data.admin_mode_enable === true;
            setIsLocked(blocked && !techMode);
            setIsTechMode(techMode);
          }
          return () => off(deviceRef);
        });
        return () => off(deviceRef);
      }
    }, (error) => {
      console.error("Error en el monitor de bloqueo EDUControlPro:", error);
    });

    // 2. También escuchar cambios en dispositivos para confirmación
    const deviceRef = ref(rtdb, `dispositivos/${deviceId}`);
    const unsubscribeDevice = onValue(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const blocked = data.shield_mode_enable === true;
        const techMode = data.admin_mode_enable === true;
        // Actualizar solo si status no tiene el dato
        setIsLocked(prev => prev || (blocked && !techMode));
        setIsTechMode(techMode);
      }
    });

    return () => {
      off(statusRef);
      off(deviceRef);
    };
  }, [deviceId]);

  // Si no está bloqueado o está en modo técnico, no renderizamos nada
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
        
        {isTechMode && (
          <p className="text-blue-500 text-[8px] font-bold uppercase mt-4">
            ⚠️ MODO TÉCNICO ACTIVADO - EL BLOQUEO ESTÁ ANULADO
          </p>
        )}
      </div>

      {/* Identificador de seguridad en la esquina */}
      <div className="absolute bottom-10 text-[8px] font-mono text-slate-700 uppercase tracking-widest">
        Device ID: {deviceId?.slice(0, 8)}...
      </div>
    </div>
  );
}
