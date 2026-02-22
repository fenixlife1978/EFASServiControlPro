'use client';
import { Suspense, useState } from 'react';
import { Loader2, QrCode, X } from 'lucide-react';
import LoginForm from './login-form';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { db } from '@/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function LoginPage() {
  const [isScanning, setIsScanning] = useState(false);

  const startScan = async () => {
    try {
      const granted = await BarcodeScanner.requestPermissions();
      if (granted.camera !== 'granted') {
        alert('Se requiere permiso de cámara para vincular');
        return;
      }

      setIsScanning(true);
      document.body.classList.add('scanner-active');

      const { barcodes } = await BarcodeScanner.scan();

      if (barcodes.length > 0) {
        const qrData = barcodes[0].displayValue;
        // Vinculación directa en Firebase
        const dispositivoRef = doc(db, "dispositivos", qrData);
        await updateDoc(dispositivoRef, {
          vinculado: true,
          ultimoAcceso: serverTimestamp(),
          estado: 'activo'
        });
        alert('¡Dispositivo vinculado con éxito!');
      }
    } catch (error) {
      console.error('Error en escaneo:', error);
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
      {/* UI del Escáner (solo visible cuando se activa la cámara) */}
      {isScanning && (
        <div className="scanner-ui fixed inset-0 z-50 flex flex-col items-center justify-between p-10 bg-transparent">
          <div className="w-64 h-64 border-2 border-orange-500 rounded-3xl border-dashed animate-pulse mt-20" />
          <button 
            onClick={stopScan}
            className="mb-10 bg-red-600 text-white px-8 py-4 rounded-full font-black flex items-center gap-2 uppercase italic text-xs shadow-2xl"
          >
            <X size={18} /> Cancelar Escaneo
          </button>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-4">
        <Suspense fallback={<LoadingState />}>
          <LoginForm />
        </Suspense>

        {/* Botón de Vinculación para EFAS ServiControlPro */}
        {!isScanning && (
          <button 
            onClick={startScan}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl border border-slate-800 bg-slate-900/50 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all group"
          >
            <QrCode className="text-slate-500 group-hover:text-orange-500" size={20} />
            <span className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 group-hover:text-white">
              Vincular Dispositivo
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
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#f97316]" strokeWidth={2.5} />
        <div className="absolute h-16 w-16 rounded-full border-4 border-[#f97316]/10 border-t-[#f97316]/40 animate-pulse" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
          EFAS <span className="text-[#f97316]">ServiControlPro</span>
        </h2>
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">
          Initializing Secure Protocol
        </p>
      </div>
    </div>
  );
}