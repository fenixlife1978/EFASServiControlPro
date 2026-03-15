'use client';
import { Suspense, useState, useEffect } from 'react';
import { Loader2, QrCode, X, CheckCircle2 } from 'lucide-react';
import LoginForm from './login-form';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Device } from '@capacitor/device'; // Corregido: @capacitor/device
import { Preferences } from '@capacitor/preferences'; // Corregido: @capacitor/preferences
import { rtdb } from '@/firebase/config';
import { ref, update, get } from 'firebase/database';
import { dbService } from '@/lib/dbService';

export default function LoginPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [bindingInfo, setBindingInfo] = useState<{name: string, location: string} | null>(null);

  useEffect(() => {
    const handleStartScan = () => startScan();
    window.addEventListener('start-qr-scan', handleStartScan);
    return () => window.removeEventListener('start-qr-scan', handleStartScan);
  }, []);

  const stopScan = () => {
    setIsScanning(false);
    document.body.classList.remove('scanner-active');
  };

  const startScan = async () => {
    try {
      const granted = await BarcodeScanner.requestPermissions();
      if (granted.camera !== 'granted') {
        alert('Se requiere acceso a la cámara para el protocolo Shield');
        return;
      }

      setIsScanning(true);
      document.body.classList.add('scanner-active');

      const { barcodes } = await BarcodeScanner.scan();

      if (barcodes.length > 0) {
        const rawValue = barcodes[0].displayValue;
        // Limpieza profunda del valor QR
        let cleanValue = rawValue.replace(/[\n\r\t]/g, "").trim();
        
        let qrId = "";
        try {
          const data = JSON.parse(cleanValue);
          qrId = String(data.deviceId || data.enrollmentId || cleanValue);
        } catch (e) {
          qrId = cleanValue;
        }
        
        qrId = qrId.toUpperCase().replace(/[^A-Z0-9-]/g, "");

        // Captura de Identidad de Hardware
        const info = await Device.getInfo();
        const id = await Device.getId();

        const deviceRef = ref(rtdb, `dispositivos/${qrId}`);

        // Sincronización Inmediata con RTDB
        await update(deviceRef, {
          vinculado: true,
          fechaVinculacion: new Date().toISOString(),
          ultimoAcceso: new Date().toISOString(),
          estado: 'activo',
          hardware: {
            uuid: id.identifier || 'unknown_uuid',
            modelo: info.model,
            marca: info.manufacturer,
            os: info.operatingSystem,
            versionOs: info.osVersion,
            plataforma: info.platform
          }
        });

        const snapshot = await get(deviceRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          
          setBindingInfo({
            name: data.alumno_asignado || data.asignadoA || 'Unidad Protegida',
            location: data.institutoNombre || 'Sede Autorizada'
          });
          
          const instId = data.InstitutoId || "";
          
          // Almacenamiento persistente en el dispositivo
          await Preferences.set({ key: 'deviceId', value: qrId });
          await Preferences.set({ key: 'InstitutoId', value: instId });
          
          localStorage.setItem('deviceId', qrId);
          localStorage.setItem('InstitutoId', instId);
        }
      }
    } catch (error: any) {
      console.error('Shield Error:', error);
      alert("Error en protocolo: Asegúrate de estar en una tablet autorizada.");
    } finally {
      stopScan();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c10] p-4">
      
      {/* Modal de Vinculación Exitosa */}
      {bindingInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6 animate-in fade-in duration-500">
          <div className="bg-[#0f1117] border border-orange-500/20 p-10 rounded-[3.5rem] max-w-sm w-full text-center shadow-[0_0_80px_rgba(249,115,22,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
            
            <div className="flex justify-center mb-8">
              <div className="bg-orange-500/10 p-5 rounded-3xl border border-orange-500/20 shadow-inner">
                <CheckCircle2 size={50} className="text-orange-500" />
              </div>
            </div>

            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1 leading-tight">Hardware <br/> Vinculado</h3>
            <p className="text-[9px] text-orange-500 uppercase font-black tracking-[0.4em] mb-8">Protocolo Shield Activo</p>
            
            <div className="bg-white/5 rounded-[2rem] p-6 mb-10 border border-white/5 space-y-4">
              <div className="text-left border-l-2 border-orange-500/30 pl-4">
                <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Asignado a</span>
                <p className="text-white font-black italic uppercase text-sm truncate leading-none mt-1">{bindingInfo.name}</p>
              </div>
              <div className="text-left border-l-2 border-slate-700 pl-4">
                <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Sede</span>
                <p className="text-slate-300 font-bold uppercase text-[10px] truncate leading-none mt-1">{bindingInfo.location}</p>
              </div>
            </div>

            <button 
              onClick={() => window.location.replace('/dashboard')}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-[1.8rem] font-black uppercase italic text-[11px] transition-all shadow-lg shadow-orange-900/20 active:scale-95"
            >
              Entrar al Sistema
            </button>
          </div>
        </div>
      )}

      {/* Escáner Activo */}
      {isScanning && (
        <div className="scanner-ui fixed inset-0 z-50 flex flex-col items-center justify-between p-12 bg-transparent">
          <div className="relative mt-20">
            <div className="w-72 h-72 border-2 border-orange-500/50 rounded-[3rem] border-dashed animate-[spin_15s_linear_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
               <QrCode className="text-orange-500 w-12 h-12 animate-pulse" />
            </div>
          </div>
          
          <div className="text-center space-y-6 mb-10">
            <p className="text-white font-black uppercase italic text-[10px] tracking-[0.3em] animate-pulse">Buscando Código Shield...</p>
            <button 
              onClick={stopScan}
              className="bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 text-red-500 px-10 py-5 rounded-2xl font-black flex items-center gap-3 uppercase italic text-[10px] transition-all backdrop-blur-md"
            >
              <X size={18} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Login / Botón de Vinculación */}
      <div className="w-full max-w-md flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-700">
        <Suspense fallback={<LoadingState />}>
          <LoginForm />
        </Suspense>

        {!isScanning && !bindingInfo && (
          <button 
            onClick={startScan}
            className="flex items-center justify-center gap-4 w-full py-5 rounded-[2rem] border border-white/5 bg-[#11141d]/50 hover:bg-orange-600/10 hover:border-orange-500/30 transition-all group active:scale-[0.98] shadow-xl"
          >
            <div className="p-2 bg-slate-800 rounded-xl group-hover:bg-orange-500/20 transition-colors">
               <QrCode className="text-slate-500 group-hover:text-orange-500" size={18} />
            </div>
            <span className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500 group-hover:text-white transition-colors">
              Vincular Hardware EDU
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 bg-[#0a0c10] rounded-[3rem] border border-white/5">
      <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      <div className="text-center">
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">EDU <span className="text-orange-500">ControlPro</span></h2>
        <p className="text-[8px] font-black uppercase tracking-[0.6em] text-slate-600 mt-1">Shield Security</p>
      </div>
    </div>
  );
}
