'use client';
import React, { useEffect, useState } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { db, rtdb } from '@/firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import { Device } from '@capacitor/device'; 
import { Preferences } from '@capacitor/preferences';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';

export default function ScannerVincular() {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScan = async () => {
    if (Capacitor.getPlatform() !== 'android') {
      const msg = 'El escáner solo funciona en dispositivos Android';
      setError(msg);
      await Toast.show({ text: msg });
      return;
    }

    try {
      setIsScanning(true);
      setError(null);

      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length === 0) {
        setIsScanning(false);
        return;
      }

      const rawData = barcodes[0].displayValue;
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        setError('Formato de QR inválido');
        setIsScanning(false);
        return;
      }

      const deviceId = data.deviceId; // Ejemplo: "DEV-0001"
      const instId = data.InstitutoId || '';
      const cleanAula = String(data.aulaId || '').trim().toUpperCase();
      const cleanSeccion = String(data.seccion || '').trim().toUpperCase();

      if (!deviceId) {
        setError('El QR no contiene deviceId');
        setIsScanning(false);
        return;
      }

      // 1. Guardar localmente en la tablet
      await Preferences.set({ key: 'deviceId', value: String(deviceId) });
      await Preferences.set({ key: 'InstitutoId', value: String(instId) });
      await Preferences.set({ key: 'aulaId', value: cleanAula });
      await Preferences.set({ key: 'seccion', value: cleanSeccion });
      await Preferences.set({ key: 'rol', value: String(data.rol || 'alumno') });

      const info = await Device.getInfo();
      const idHardware = await Device.getId();

      // 2. FIRESTORE: Nodo "dispositivos" (Mismo nombre que RTDB por consistencia)
      const deviceRef = doc(db, 'dispositivos', deviceId);
      
      const deviceData = {
        id: deviceId,
        vinculado: true,
        status: 'active',
        rol: data.rol || 'alumno',
        InstitutoId: instId,
        aulaId: cleanAula,
        seccion: cleanSeccion,
        alumno_asignado: data.rol === 'alumno' ? 'Sin asignar' : '',
        
        admin_mode_enable: false,
        useWhitelist: true,
        shieldMode: true,
        
        hardware: {
          modelo: info.model,
          marca: info.manufacturer,
          uuid: idHardware.identifier,
          aulaId: cleanAula,
          seccion: cleanSeccion,
        },
        online: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // --- GUARDAR EN FIRESTORE ---
      try {
        await setDoc(deviceRef, deviceData, { merge: true });
        console.log("✅ Firestore OK");
      } catch (fsError: any) {
        console.error("❌ Firestore Error:", fsError);
      }

      // 3. RTDB: Nodo "dispositivos/${deviceId}" (CORREGIDO)
      try {
        // AQUÍ ES DONDE APUNTAMOS A LA RAÍZ "dispositivos"
        const rtdbRef = ref(rtdb, `dispositivos/${deviceId}`);
        
        await set(rtdbRef, {
          InstitutoId: instId,
          alumno_asignado: data.rol === 'alumno' ? 'Sin asignar' : '',
          online: true,
          lastPulse: Date.now(),
          lastSeen: Date.now(),
          estado: "activo",
          vinculado: true,
          rol: data.rol || 'alumno',
          createdAt: Date.now(),
          
          hardware: {
            aulaId: cleanAula,
            seccion: cleanSeccion,
            modelo: info.model,
            marca: info.manufacturer,
            uuid: idHardware.identifier,
          }
        });
        
        console.log(`✅ RTDB OK en dispositivos/${deviceId}`);
        await Toast.show({ text: '✅ VINCULACIÓN EXITOSA', duration: 'long' });
      } catch (rtdbError: any) {
        console.error("❌ RTDB Error:", rtdbError);
      }

      setTimeout(() => {
        window.location.href = '/';
      }, 1500);

    } catch (e: any) {
      console.error("Error general:", e);
      setError(`Error: ${e.message}`);
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
        <div className="w-28 h-28 bg-orange-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border-2 border-orange-500/20">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl animate-pulse"></div>
        </div>
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-3">
          EDU<span className="text-orange-500">ControlPro</span>
        </h2>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8">
          Sincronizando con Realtime Database...
        </p>
        {error && <p className="text-red-500 text-xs font-bold uppercase">{error}</p>}
      </div>
    </div>
  );
}
