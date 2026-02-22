'use client';
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { registerPlugin } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { ShieldAlert, QrCode, Loader2, BellRing, Camera, Tablet } from 'lucide-react';

const DeviceControl = registerPlugin<any>('DeviceControl');

const APPS_PERMITIDAS = [
  { id: 1, nombre: 'Matemáticas', icon: '🧮' },
  { id: 2, nombre: 'Diccionario', icon: '📖' },
  { id: 3, nombre: 'Navegador', icon: '🌐' },
  { id: 4, nombre: 'Cámara', icon: '📸' },
];

export default function EstudiantePage() {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('efas_device_id');
    if (savedId) {
      iniciarMonitoreo(savedId);
    } else {
      setLoading(false);
    }
  }, []);

  const iniciarMonitoreo = (id: string) => {
    setIsEnrolled(true);
    const unsub = onSnapshot(doc(db, "dispositivos", id), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setDeviceInfo(data);
        setIsLocked(data.comando_bloqueo === true);
        if (data.mensaje_alerta && data.mensaje_alerta !== activeMessage) {
          setActiveMessage(data.mensaje_alerta);
        }
        if (data.comando_bloqueo === true) {
          try { DeviceControl.lockDevice(); } catch(e) {}
        }
      }
      setLoading(false);
    });
    return unsub;
  };

  const handleEscaneoReal = async () => {
    try {
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();
      
      if (!isNative) {
        const manualCode = prompt("Simulación: Pega el JSON del QR:");
        if (manualCode) procesarEscaneoQR(manualCode);
        return;
      }

      const granted = await BarcodeScanner.requestPermissions();
      if (granted.camera !== 'granted') return alert("Permiso de cámara denegado");

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        procesarEscaneoQR(barcodes[0].displayValue);
      }
    } catch (e) {
      console.error(e);
      alert("Error al activar escáner");
    }
  };

  const procesarEscaneoQR = async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      // Ajustado para coincidir con el Panel de Super Admin
      if (data.action === 'link_device' || data.action === 'enroll') {
        setLoading(true);
        const newDeviceId = `DEV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        await setDoc(doc(db, "dispositivos", newDeviceId), {
          id: newDeviceId,
          InstitutoId: data.inst || data.InstitutoId, // Soporta ambos formatos
          aulaId: data.aula || data.aulaId,           // Soporta ambos formatos
          status: 'pending_name',                     // ACTIVA EL MODAL EN SUPER ADMIN
          alumno_asignado: "Esperando nombre...",
          comando_bloqueo: false,
          mensaje_alerta: null,
          createdAt: serverTimestamp(),
          lastConnection: serverTimestamp()
        });

        localStorage.setItem('efas_device_id', newDeviceId);
        iniciarMonitoreo(newDeviceId);
      }
    } catch (e) {
      alert("QR no válido para EDU");
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center text-white"><Loader2 className="animate-spin text-orange-500" /></div>;

  if (!isEnrolled) return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-6 text-white">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="bg-orange-500/10 p-8 rounded-[2.5rem] w-32 h-32 mx-auto flex items-center justify-center border border-orange-500/20 shadow-2xl">
            <Tablet className="w-16 h-16 text-orange-500" />
        </div>
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Efas <span className="text-orange-500">Guardian</span></h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Dispositivo no vinculado</p>
        </div>
        <button 
            onClick={handleEscaneoReal}
            className="w-full bg-orange-500 text-white py-6 rounded-[2rem] font-black uppercase italic flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20 hover:scale-105 transition-all"
        >
            <QrCode /> Iniciar Vinculación
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-8 font-sans">
      <header className="mb-12 flex justify-between items-center bg-[#11141d] p-6 rounded-[2.5rem] border border-white/5">
        <div>
          <h1 className="text-xl font-black italic uppercase text-orange-500 leading-none">EDU</h1>
          <p className="text-[8px] font-bold text-slate-500 uppercase">ServControlPro</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase italic text-white">{deviceInfo?.alumno_asignado}</p>
          <p className="text-[8px] font-bold text-green-500 uppercase">Conectado</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6">
        {APPS_PERMITIDAS.map((app) => (
          <button key={app.id} className="flex flex-col items-center p-12 bg-[#11141d] border border-white/5 rounded-[3rem] active:scale-95 transition-all">
            <span className="text-6xl mb-4">{app.icon}</span>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{app.nombre}</span>
          </button>
        ))}
      </div>

      {activeMessage && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[3rem] text-center max-w-sm border-b-8 border-orange-500">
                <BellRing className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <p className="text-xl font-bold text-slate-900 mb-6 uppercase italic">{activeMessage}</p>
                <button onClick={() => setActiveMessage(null)} className="bg-slate-900 text-white px-8 py-3 rounded-full font-black uppercase text-xs">Entendido</button>
            </div>
        </div>
      )}

      {isLocked && (
        <div className="fixed inset-0 bg-red-600 z-[100] flex flex-col items-center justify-center text-white p-10">
          <ShieldAlert className="w-24 h-24 mb-4 animate-pulse" />
          <h1 className="text-5xl font-black uppercase italic tracking-tighter">Acceso Restringido</h1>
          <p className="text-sm font-bold uppercase mt-4 opacity-80 text-center">Este dispositivo ha sido bloqueado por el administrador</p>
        </div>
      )}
    </div>
  );
}
