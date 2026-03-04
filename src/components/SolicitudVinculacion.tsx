'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

export default function SolicitudVinculacion() {
  const [status, setStatus] = useState('idle'); // idle, enviando, esperando, vinculado
  const [hardwareId, setHardwareId] = useState('');

  const enviarSolicitud = async () => {
    setStatus('enviando');
    try {
      const idHardware = await Device.getId();
      const info = await Device.getInfo();
      const uuid = idHardware.identifier;
      setHardwareId(uuid);

      // Crear solicitud en Firestore
      await setDoc(doc(db, "solicitudes_vinculacion", uuid), {
        uuid,
        modelo: info.model,
        marca: info.manufacturer,
        timestamp: new Date().getTime(),
        status: 'pendiente'
      });

      setStatus('esperando');
    } catch (e) {
      console.error(e);
      alert("Error al enviar solicitud");
      setStatus('idle');
    }
  };

  // Listener: Esperar a que el admin nos vincule
  useEffect(() => {
    if (status === 'esperando' && hardwareId) {
      const unsub = onSnapshot(doc(db, "solicitudes_vinculacion", hardwareId), (docSnap) => {
        if (docSnap.exists() && docSnap.data().status === 'vinculado') {
          const data = docSnap.data();
          finalizarVinculacion(data.deviceId, data.InstitutoId);
        }
      });
      return () => unsub();
    }
  }, [status, hardwareId]);

  const finalizarVinculacion = async (deviceId: string, instId: string) => {
    await Preferences.set({ key: 'deviceId', value: deviceId });
    await Preferences.set({ key: 'InstitutoId', value: instId });
    alert("✅ DISPOSITIVO VINCULADO: " + deviceId);
    window.location.href = "/";
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0c10] p-6 text-center">
      <h2 className="text-white text-2xl font-black mb-4 uppercase italic">
        EDU <span className="text-orange-500">CONTROL</span>
      </h2>
      
      {status === 'idle' && (
        <button 
          onClick={enviarSolicitud}
          className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest animate-bounce"
        >
          Vincular este Dispositivo
        </button>
      )}

      {status === 'esperando' && (
        <div className="space-y-4">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 font-medium">Solicitud enviada...</p>
          <p className="text-xs text-slate-600">ID: {hardwareId}</p>
          <p className="text-white text-sm">Esperando aprobación del Super Admin</p>
        </div>
      )}
    </div>
  );
}
