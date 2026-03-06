'use client';
import React, { useEffect, useState } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { db } from '@/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';

export default function QRScanner() {
  const [isScanning, setIsScanning] = useState(false);

  const startScanning = async () => {
    // 1. Verificar plataforma
    if (Capacitor.getPlatform() !== 'android') {
      await Toast.show({ text: 'El escáner solo funciona en Android' });
      return;
    }

    try {
      setIsScanning(true);
      
      // 2. Verificar permisos de cámara
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      // 3. Escanear QR
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length === 0) {
        await Toast.show({ text: 'No se detectó ningún código QR' });
        setIsScanning(false);
        return;
      }

      const rawData = barcodes[0].displayValue;
      
      // 4. Parsear datos del QR
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        await Toast.show({ text: 'Formato de QR inválido' });
        setIsScanning(false);
        return;
      }

      const deviceId = data.deviceId;
      if (!deviceId) {
        await Toast.show({ text: 'QR no contiene deviceId' });
        setIsScanning(false);
        return;
      }

      // 5. GUARDAR EN PREFERENCES (para el MonitorService)
      await Preferences.set({ key: 'deviceId', value: String(deviceId) });
      await Preferences.set({ key: 'InstitutoId', value: String(data.InstitutoId || '') });
      await Preferences.set({ key: 'nombreInstituto', value: String(data.nombreInstituto || data.InstitutoId || '') });
      await Preferences.set({ key: 'aulaId', value: String(data.aulaId || '') });
      await Preferences.set({ key: 'seccion', value: String(data.seccion || '') });
      await Preferences.set({ key: 'rol', value: String(data.rol || 'alumno') });

      // 6. Obtener información del hardware
      const info = await Device.getInfo();
      const idHardware = await Device.getId();

      // 7. Actualizar Firestore
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
        lastUpdated: serverTimestamp()
      });

      // 8. Notificar éxito
      await Toast.show({ text: '✅ Tablet vinculada correctamente' });
      
      // 9. Redirigir a la pantalla principal
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);

    } catch (error: any) {
      console.error("Error en escaneo:", error);
      await Toast.show({ 
        text: error.message || 'Error al escanear',
        duration: 'long'
      });
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    startScanning();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0c10] text-white">
      <div className="text-center p-10">
        <div className="w-24 h-24 bg-orange-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl animate-pulse"></div>
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4">
          EDU<span className="text-orange-500">ControlPro</span>
        </h2>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">
          {isScanning ? 'ESCANEANDO...' : 'LISTO PARA VINCULAR'}
        </p>
        
        {!isScanning && (
          <button 
            onClick={startScanning}
            className="bg-orange-500 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-wider hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
          >
            Reintentar Escaneo
          </button>
        )}
      </div>
    </div>
  );
}
