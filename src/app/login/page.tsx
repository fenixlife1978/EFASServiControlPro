'use client';
import { Suspense, useState, useEffect } from 'react';
import { Loader2, QrCode, X, CheckCircle2 } from 'lucide-react';
import LoginForm from './login-form';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Device } from '@capacitor/device';
import { db } from '@/firebase/config';
import { doc, updateDoc, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [bindingInfo, setBindingInfo] = useState<{name: string, location: string} | null>(null);

  useEffect(() => {
    const handleStartScan = () => startScan();
    window.addEventListener('start-qr-scan', handleStartScan);
    return () => window.removeEventListener('start-qr-scan', handleStartScan);
  }, []);

  const startScan = async () => {
    try {
      const granted = await BarcodeScanner.requestPermissions();
      if (granted.camera !== 'granted') {
        alert('Se requiere permiso de cámara para vincular hardware');
        return;
      }

      setIsScanning(true);
      document.body.classList.add('scanner-active');

      const { barcodes } = await BarcodeScanner.scan();

      if (barcodes.length > 0) {
        const qrData = JSON.parse(barcodes[0].displayValue); const qrId = qrData.deviceId || barcodes[0].displayValue; // El ID que viene en el QR del sistema
        
        // 1. Obtener info del hardware local
        const info = await Device.getInfo();
        const id = await Device.getId();

        // 2. Referencia al documento en Firebase
        const dispositivoRef = doc(db, "dispositivos", qrId);

        // 3. Intercambio: Entregamos hardware al sistema
        await updateDoc(dispositivoRef, {
          vinculado: true,
          fechaVinculacion: serverTimestamp(),
          ultimoAcceso: serverTimestamp(),
          estado: 'activo',
          hardware: {
            uuid: id.identifier,
            modelo: info.model,
            marca: info.manufacturer,
            os: info.operatingSystem,
            versionOs: info.osVersion,
            plataforma: info.platform
          }
        });

        // 4. El sistema nos responde: ¿A quién pertenezco?
        const snap = await getDoc(dispositivoRef);
        if (snap.exists()) {
          const data = snap.data();
          setBindingInfo({
            name: data.asignadoA || 'Usuario no asignado',
            location: data.institutoNombre || 'Sede Principal'
          });
          
          // Guardamos identidad localmente para que el dispositivo "sepa" quién es siempre
          localStorage.setItem('deviceId', qrId);
          localStorage.setItem('InstitutoId', data.InstitutoId);
        }
      }
    } catch (error) {
      console.error('Error en vinculación:', error);
    } finally {
      stopScan();
    }
  };

  const stopScan = () => {
    setIsScanning(false);
    document.body.classList.remove('scanner-active');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c10] p-4">
      {/* Modal de Éxito de Vinculación */}
      {bindingInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
          <div className="bg-[#0f1117] border border-orange-500/30 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-[0_0_50px_rgba(249,115,22,0.2)]">
            <div className="flex justify-center mb-6">
              <div className="bg-orange-500/20 p-4 rounded-full">
                <CheckCircle2 size={48} className="text-[#f97316]" />
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase italic mb-2">Hardware Vinculado</h3>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-6">Identidad Confirmada</p>
            
            <div className="bg-slate-900/50 rounded-2xl p-4 mb-8 border border-slate-800">
              <div className="mb-3 text-left">
                <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Asignado a:</span>
                <p className="text-white font-black italic uppercase text-sm">{bindingInfo.name}</p>
              </div>
              <div className="text-left">
                <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Institución:</span>
                <p className="text-[#f97316] font-black italic uppercase text-xs">{bindingInfo.location}</p>
              </div>
            </div>

            <button 
              onClick={() => window.location.replace('/dashboard')}
              className="w-full bg-[#f97316] hover:bg-white hover:text-[#f97316] text-white py-4 rounded-2xl font-black uppercase italic text-xs transition-all"
            >
              Iniciar Sistema
            </button>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="scanner-ui fixed inset-0 z-50 flex flex-col items-center justify-between p-10 bg-transparent">
          <div className="w-64 h-64 border-2 border-[#f97316] rounded-[2.5rem] border-dashed animate-pulse mt-20" />
          <button 
            onClick={stopScan}
            className="mb-10 bg-red-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 uppercase italic text-[10px]"
          >
            <X size={16} /> Cancelar
          </button>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-4">
        <Suspense fallback={<LoadingState />}>
          <LoginForm />
        </Suspense>

        {!isScanning && !bindingInfo && (
          <button 
            onClick={startScan}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl border border-slate-800 bg-slate-900/50 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all group"
          >
            <QrCode className="text-slate-500 group-hover:text-[#f97316]" size={20} />
            <span className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 group-hover:text-white">
              Vincular Hardware
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" />
      <h2 className="text-2xl font-black italic text-white uppercase">EDU <span className="text-[#f97316]">ControlPro</span></h2>
    </div>
  );
}
