'use client';
import React, { useEffect } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { db } from '@/firebase/config';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';

export default function ScannerVincular() {
  const startScan = async () => {
    try {
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const rawData = barcodes[0].displayValue;
        
        // --- BLOQUE DE DIAGNÓSTICO ---
        alert("Contenido detectado: " + rawData);
        // ------------------------------

        const data = JSON.parse(rawData); 
        const deviceId = data.deviceId;

        if (!deviceId) {
          alert("Error: El JSON no tiene deviceId");
          return;
        }

        const info = await Device.getInfo();
        const idHardware = await Device.getId();

        const deviceRef = doc(db, "dispositivos", deviceId);
        await updateDoc(deviceRef, {
          vinculado: true,
          status: 'active',
          rol: data.rol || 'alumno',
          hardware: { modelo: info.model, marca: info.manufacturer, uuid: idHardware.identifier },
          lastUpdated: serverTimestamp()
        });

        alert("✅ VINCULADO: " + deviceId);
        window.location.href = "/";
      }
    } catch (e: any) {
      alert("❌ ERROR CRÍTICO: " + e.message);
      console.error(e);
    }
  };

  useEffect(() => {
    setTimeout(() => startScan(), 1000);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <p className="text-orange-500 font-bold">MODO DIAGNÓSTICO ACTIVO</p>
    </div>
  );
}
