'use client';
import React, { useEffect, useState } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { db } from '@/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';

export default function ScannerVincular() {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScan = async () => {
    // 1. Verificar plataforma
    if (Capacitor.getPlatform() !== 'android') {
      setError('El escáner solo funciona en dispositivos Android');
      await Toast.show({ text: 'El escáner solo funciona en Android' });
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      
      // 2. Verificar permisos de cámara
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      // 3. Escanear QR
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length === 0) {
        setError('No se detectó ningún código QR');
        await Toast.show({ text: 'No se detectó ningún código QR' });
        setIsScanning(false);
        return;
      }

      const rawData = barcodes[0].displayValue;
      
      // 4. Mostrar diagnóstico (útil para depuración)
      console.log("Contenido QR:", rawData);

      // 5. Parsear datos del QR
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        setError('Formato de QR inválido');
        await Toast.show({ text: 'Formato de QR inválido' });
        setIsScanning(false);
        return;
      }

      const deviceId = data.deviceId;
      if (!deviceId) {
        setError('El QR no contiene deviceId');
        await Toast.show({ text: 'QR no contiene deviceId' });
        setIsScanning(false);
        return;
      }

      // 6. GUARDAR EN PREFERENCES (para el MonitorService)
      await Preferences.set({ key: 'deviceId', value: String(deviceId) });
      await Preferences.set({ key: 'InstitutoId', value: String(data.InstitutoId || '') });
      await Preferences.set({ key: 'nombreInstituto', value: String(data.nombreInstituto || data.InstitutoId || '') });
      await Preferences.set({ key: 'aulaId', value: String(data.aulaId || '') });
      await Preferences.set({ key: 'seccion', value: String(data.seccion || '') });
      await Preferences.set({ key: 'rol', value: String(data.rol || 'alumno') });

      // 7. Obtener información del hardware
      const info = await Device.getInfo();
      const idHardware = await Device.getId();

      // 8. Actualizar Firestore
      const deviceRef = doc(db, "dispositivos", deviceId);
      await updateDoc(deviceRef, {
        vinculado: true,
        status: 'active',
        rol: data.rol || 'alumno',
        InstitutoId: data.InstitutoId || '',
        aulaId: data.aulaId || '',
        seccion: data.seccion || '',
        hardware: { 
          modelo: info.model, 
          marca: info.manufacturer, 
          uuid: idHardware.identifier 
        },
        online: true,
        ultimoAcceso: serverTimestamp(),
        cortarNavegacion: false,
        shieldMode: false,
        admin_mode_enable: false,
        bloqueos: 0,
        lastUpdated: serverTimestamp()
      });

      // 9. Notificar éxito
      await Toast.show({ text: '✅ Tablet vinculada correctamente' });
      
      // 10. Redirigir a la pantalla principal
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);

    } catch (e: any) {
      console.error("Error crítico:", e);
      setError(e.message || 'Error al vincular');
      await Toast.show({ 
        text: e.message || 'Error al vincular',
        duration: 'long'
      });
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    startScan();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0c10] text-white">
      <div className="text-center p-10 max-w-md">
        {/* Animación/Logo */}
        <div className="w-28 h-28 bg-orange-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border-2 border-orange-500/20">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl animate-pulse shadow-2xl shadow-orange-500/40"></div>
        </div>
        
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-3">
          EDU<span className="text-orange-500">ControlPro</span>
        </h2>
        
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8">
          VINCULACIÓN DE HARDWARE
        </p>
        
        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 mb-6">
            <p className="text-red-500 text-[11px] font-bold uppercase mb-2">⚠️ ERROR</p>
            <p className="text-slate-400 text-[10px]">{error}</p>
          </div>
        ) : (
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">
            {isScanning ? 'ESCANEANDO CÓDIGO QR...' : 'PREPARANDO CÁMARA...'}
          </p>
        )}
        
        {error && (
          <button 
            onClick={startScan}
            disabled={isScanning}
            className="bg-orange-500 disabled:bg-slate-800 disabled:cursor-not-allowed px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-wider hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
          >
            {isScanning ? 'ESCANEANDO...' : 'REINTENTAR'}
          </button>
        )}
      </div>
    </div>
  );
}
