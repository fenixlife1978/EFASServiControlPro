'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { Lock } from 'lucide-react';

export default function LockListener() {
  const [isLocked, setIsLocked] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Recuperamos el ID que vinculamos con el QR desde el localStorage
    const savedId = localStorage.getItem('EDU_Device_ID');
    if (savedId) setDeviceId(savedId);
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    // Escuchamos directamente el documento del dispositivo vinculado
    const unsub = onSnapshot(doc(db, "usuarios", deviceId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsLocked(data.bloqueado === true);
      }
    });

    return () => unsub();
  }, [deviceId]);

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-[#0f1117] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-500/10 border-2 border-red-500/50 p-10 rounded-[3rem] backdrop-blur-xl mb-8">
        <Lock size={100} className="text-red-500 animate-pulse" />
      </div>
      <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">
        ACCESO <span className="text-red-500">RESTRINGIDO</span>
      </h1>
      <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-4">
        SISTEMA DE CONTROL EDU SERVICONTROLPRO
      </p>
    </div>
  );
}
