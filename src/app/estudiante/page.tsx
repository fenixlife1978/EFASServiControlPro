'use client';
import React, { useEffect, useState } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, set, serverTimestamp, off } from 'firebase/database';
import { registerPlugin } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { ShieldAlert, QrCode, Loader2, BellRing, Tablet, Smartphone } from 'lucide-react';

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
    const deviceRef = ref(rtdb, `dispositivos/${id}`);

    // Suscripción en tiempo real vía RTDB (Latencia ultra baja)
    onValue(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDeviceInfo(data);
        setIsLocked(data.comando_bloqueo === true);
        
        if (data.mensaje_alerta && data.mensaje_alerta !== activeMessage) {
          setActiveMessage(data.mensaje_alerta);
        }
        
        // Ejecución de comando nativo de bloqueo
        if (data.comando_bloqueo === true) {
          try { DeviceControl.lockDevice(); } catch(e) { console.warn("Plugin nativo no disponible"); }
        }
      }
      setLoading(false);
    });

    return () => off(deviceRef);
  };

  const handleEscaneoReal = async () => {
    try {
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();
      
      if (!isNative) {
        const manualCode = prompt("Simulación: Pega el JSON del QR de EDUControlPro:");
        if (manualCode) procesarEscaneoQR(manualCode);
        return;
      }

      const granted = await BarcodeScanner.requestPermissions();
      if (granted.camera !== 'granted') return alert("Permiso de cámara necesario para vincular");

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        procesarEscaneoQR(barcodes[0].displayValue);
      }
    } catch (e) {
      alert("Error al activar cámara");
    }
  };

  const procesarEscaneoQR = async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.action === 'link_device' || data.action === 'enroll') {
        setLoading(true);
        // Generación de ID de hardware único
        const newDeviceId = `EDU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        // Registro en RTDB
        await set(ref(rtdb, `dispositivos/${newDeviceId}`), {
          id: newDeviceId,
          InstitutoId: data.inst || data.InstitutoId,
          aulaId: data.aula || data.aulaId,
          status: 'pending_name',
          alumno_asignado: "VINCULANDO...",
          comando_bloqueo: false,
          mensaje_alerta: null,
          createdAt: serverTimestamp(),
          lastConnection: serverTimestamp(),
          os: "Android/EDU-Shield"
        });

        localStorage.setItem('efas_device_id', newDeviceId);
        iniciarMonitoreo(newDeviceId);
      }
    } catch (e) {
      alert("QR no compatible con EDUControlPro");
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center text-white gap-4">
      <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Sincronizando Shield</p>
    </div>
  );

  if (!isEnrolled) return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-6 text-white">
      <div className="max-w-md w-full text-center space-y-10">
        <div className="bg-orange-600/10 p-10 rounded-[3rem] w-36 h-36 mx-auto flex items-center justify-center border-2 border-orange-500/20 shadow-[0_0_50px_rgba(234,88,12,0.15)]">
          <Smartphone className="w-16 h-16 text-orange-500" />
        </div>
        <div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter">EDU <span className="text-orange-500">ControlPro</span></h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em] mt-3">Device Enrollment System</p>
        </div>
        <button 
          onClick={handleEscaneoReal}
          className="w-full bg-orange-600 text-white py-7 rounded-[2.5rem] font-black uppercase italic flex items-center justify-center gap-4 shadow-xl shadow-orange-900/20 active:scale-95 transition-all"
        >
          <QrCode className="w-6 h-6" /> Vincular Tablet
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-6 font-sans select-none">
      <header className="mb-8 flex justify-between items-center bg-[#11141d]/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-orange-500 leading-none">EDU</h1>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">ControlPro Shield</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-[11px] font-black uppercase italic text-white bg-white/5 px-4 py-1 rounded-full mb-1">
            {deviceInfo?.alumno_asignado}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <p className="text-[8px] font-bold text-green-500 uppercase tracking-widest text-right">Sistema Protegido</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {APPS_PERMITIDAS.map((app) => (
          <button key={app.id} className="flex flex-col items-center p-10 bg-[#11141d] border border-white/5 rounded-[3.5rem] active:bg-orange-600/20 transition-all border-b-4 border-b-white/5 active:border-b-orange-500">
            <span className="text-5xl mb-4 grayscale-[0.5] group-active:grayscale-0">{app.icon}</span>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider italic">{app.nombre}</span>
          </button>
        ))}
      </div>

      {/* MODAL DE ALERTA DE PROFESOR */}
      {activeMessage && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-8">
          <div className="bg-white p-12 rounded-[4rem] text-center max-w-sm shadow-2xl border-b-[12px] border-orange-500">
            <BellRing className="w-16 h-16 text-orange-500 mx-auto mb-6 animate-bounce" />
            <p className="text-2xl font-black text-slate-900 mb-8 uppercase italic leading-tight">
              {activeMessage}
            </p>
            <button 
              onClick={() => setActiveMessage(null)} 
              className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest"
            >
              Cerrar Notificación
            </button>
          </div>
        </div>
      )}

      {/* PANTALLA DE BLOQUEO TOTAL */}
      {isLocked && (
        <div className="fixed inset-0 bg-red-700 z-[100] flex flex-col items-center justify-center text-white p-12 animate-in fade-in duration-300">
          <div className="bg-white/10 p-8 rounded-full mb-8">
            <ShieldAlert className="w-28 h-28 animate-pulse" />
          </div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter text-center leading-none">
            DISPOSITIVO <br /> <span className="text-red-200">BLOQUEADO</span>
          </h1>
          <p className="text-xs font-black uppercase mt-6 tracking-[0.3em] opacity-60 text-center max-w-xs leading-relaxed">
            Restricción aplicada por seguridad institucional EDUControlPro
          </p>
        </div>
      )}
    </div>
  );
}
