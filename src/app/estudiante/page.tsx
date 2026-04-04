'use client';
import React, { useEffect, useState } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, set, serverTimestamp, off, push } from 'firebase/database';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { ShieldAlert, QrCode, Loader2, BellRing, Tablet, Smartphone, MessageSquare } from 'lucide-react';

// Interfaces para datos de dispositivo
interface DispositivoInfo {
  id?: string;
  InstitutoId?: string;
  aulaId?: string;
  alumno_asignado?: string;
  admin_mode_enable?: boolean;  // Modo anulación técnica
  shield_mode_enable?: boolean; // Modo blindado
  mensaje?: string;             // Mensaje activo desde dirección
  remitente?: string;           // Remitente del mensaje
  messageId?: string;           // ID del mensaje
  createdAt?: number;
  lastConnection?: number;
}

interface MensajeActual {
  mensaje: string;
  remitente: string;
  messageId: string;
  timestamp: number;
  leido: boolean;
}

const APPS_PERMITIDAS = [
  { id: 1, nombre: 'Matemáticas', icon: '🧮' },
  { id: 2, nombre: 'Diccionario', icon: '📖' },
  { id: 3, nombre: 'Navegador', icon: '🌐' },
  { id: 4, nombre: 'Cámara', icon: '📸' },
];

export default function EstudiantePage() {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DispositivoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isTechMode, setIsTechMode] = useState(false);
  const [activeMessage, setActiveMessage] = useState<MensajeActual | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Cargar ID guardado al inicio
  useEffect(() => {
    const savedId = localStorage.getItem('efas_device_id');
    if (savedId) {
      setDeviceId(savedId);
      iniciarMonitoreo(savedId);
    } else {
      setLoading(false);
    }
  }, []);

  const iniciarMonitoreo = (id: string) => {
    setIsEnrolled(true);
    setDeviceId(id);
    const deviceRef = ref(rtdb, `dispositivos/${id}`);
    const mensajeRef = ref(rtdb, `dispositivos/${id}/mensaje_actual`);

    // Escuchar cambios en el dispositivo (estado de bloqueo, etc)
    const unsubscribeDevice = onValue(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDeviceInfo(data);
        
        // Modo blindado (shield_mode_enable) - bloquea completamente
        setIsBlocked(data.shield_mode_enable === true);
        
        // Modo técnico (admin_mode_enable) - anula restricciones
        setIsTechMode(data.admin_mode_enable === true);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error escuchando dispositivo:", error);
    });

    // Escuchar mensajes activos (ruta correcta que usa MessageActivity)
    const unsubscribeMensaje = onValue(mensajeRef, (snapshot) => {
      if (snapshot.exists()) {
        const msg = snapshot.val();
        if (msg.mensaje && !msg.leido) {
          setActiveMessage({
            mensaje: msg.mensaje,
            remitente: msg.remitente || 'Dirección',
            messageId: msg.messageId,
            timestamp: msg.timestamp || Date.now(),
            leido: false
          });
        }
      }
    }, (error) => {
      console.error("Error escuchando mensajes:", error);
    });

    return () => {
      off(deviceRef);
      off(mensajeRef);
    };
  };

  // Marcar mensaje como leído en RTDB
  const marcarMensajeLeido = async () => {
    if (!activeMessage || !deviceId) return;
    
    try {
      await set(ref(rtdb, `dispositivos/${deviceId}/mensaje_actual`), {
        ...activeMessage,
        leido: true,
        leido_en: Date.now()
      });
      setActiveMessage(null);
      
      // También registrar en historial de mensajes leídos
      await push(ref(rtdb, `dispositivos/${deviceId}/mensajes_leidos`), {
        messageId: activeMessage.messageId,
        mensaje: activeMessage.mensaje,
        leido_en: Date.now()
      });
    } catch (error) {
      console.error("Error marcando mensaje como leído:", error);
    }
  };

  const handleEscaneoReal = async () => {
    try {
      const isNative = Capacitor.isNativePlatform();
      
      if (!isNative) {
        const manualCode = prompt("Simulación: Pega el JSON del QR de EDUControlPro:");
        if (manualCode) procesarEscaneoQR(manualCode);
        return;
      }

      const granted = await BarcodeScanner.requestPermissions();
      if (granted.camera !== 'granted') {
        alert("Permiso de cámara necesario para vincular");
        return;
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        procesarEscaneoQR(barcodes[0].displayValue);
      }
    } catch (e) {
      console.error("Error al escanear:", e);
      alert("Error al activar cámara");
    }
  };

  const procesarEscaneoQR = async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.action === 'link_device' || data.action === 'enroll') {
        setLoading(true);
        const newDeviceId = `EDU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        await set(ref(rtdb, `dispositivos/${newDeviceId}`), {
          id: newDeviceId,
          InstitutoId: data.inst || data.InstitutoId,
          aulaId: data.aula || data.aulaId,
          status: 'pending_name',
          alumno_asignado: data.alumno || "VINCULANDO...",
          admin_mode_enable: false,
          shield_mode_enable: false,
          mensaje: null,
          mensaje_actual: null,
          createdAt: serverTimestamp(),
          lastConnection: serverTimestamp(),
          os: "Android/EDU-Shield"
        });

        localStorage.setItem('efas_device_id', newDeviceId);
        setDeviceId(newDeviceId);
        iniciarMonitoreo(newDeviceId);
      } else {
        alert("QR no válido para vinculación");
      }
    } catch (e) {
      console.error("Error procesando QR:", e);
      alert("QR no compatible con EDUControlPro");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center text-white gap-4">
      <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Sincronizando Shield</p>
    </div>
  );

  // Pantalla de vinculación
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

  // Pantalla de bloqueo (Modo Blindado activado)
  if (isBlocked && !isTechMode) {
    return (
      <div className="fixed inset-0 bg-red-700 z-[100] flex flex-col items-center justify-center text-white p-12 animate-in fade-in duration-300">
        <div className="bg-white/10 p-8 rounded-full mb-8">
          <ShieldAlert className="w-28 h-28 animate-pulse" />
        </div>
        <h1 className="text-5xl font-black uppercase italic tracking-tighter text-center leading-none">
          DISPOSITIVO <br /> <span className="text-red-200">BLOQUEADO</span>
        </h1>
        <p className="text-xs font-black uppercase mt-6 tracking-[0.3em] opacity-60 text-center max-w-xs leading-relaxed">
          Modo Blindado activado por seguridad institucional
        </p>
        {activeMessage && (
          <button 
            onClick={marcarMensajeLeido}
            className="mt-8 bg-white/20 px-6 py-3 rounded-2xl text-sm font-black uppercase flex items-center gap-2"
          >
            <MessageSquare size={16} /> Ver mensaje de dirección
          </button>
        )}
      </div>
    );
  }

  // Pantalla principal del estudiante
  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-6 font-sans select-none">
      <header className="mb-8 flex justify-between items-center bg-[#11141d]/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-orange-500 leading-none">EDU</h1>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            ControlPro Shield {isTechMode && <span className="text-blue-500 ml-2">[MODO TÉCNICO]</span>}
          </p>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-[11px] font-black uppercase italic text-white bg-white/5 px-4 py-1 rounded-full mb-1">
            {deviceInfo?.alumno_asignado || 'Cargando...'}
          </span>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isTechMode ? 'bg-blue-500' : 'bg-green-500'}`} />
            <p className={`text-[8px] font-bold uppercase tracking-widest text-right ${isTechMode ? 'text-blue-500' : 'text-green-500'}`}>
              {isTechMode ? 'Modo Técnico Activo' : 'Sistema Protegido'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {APPS_PERMITIDAS.map((app) => (
          <button 
            key={app.id} 
            disabled={isBlocked && !isTechMode}
            className={`flex flex-col items-center p-10 bg-[#11141d] border border-white/5 rounded-[3.5rem] transition-all 
              ${!isBlocked || isTechMode ? 'active:bg-orange-600/20 active:border-b-orange-500' : 'opacity-50 cursor-not-allowed'}
              border-b-4 border-b-white/5`}
          >
            <span className="text-5xl mb-4 grayscale-[0.5] group-active:grayscale-0">{app.icon}</span>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider italic">{app.nombre}</span>
          </button>
        ))}
      </div>

      {/* Modal de mensaje activo */}
      {activeMessage && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="bg-white p-12 rounded-[4rem] text-center max-w-sm shadow-2xl border-b-[12px] border-orange-500">
            <div className="flex items-center justify-center gap-3 mb-6">
              <MessageSquare className="w-12 h-12 text-orange-500" />
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                {activeMessage.remitente}
              </span>
            </div>
            <p className="text-xl font-black text-slate-900 mb-8 uppercase italic leading-tight">
              {activeMessage.mensaje}
            </p>
            <button 
              onClick={marcarMensajeLeido} 
              className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-orange-600 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}
