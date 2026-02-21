'use client';
import React, { useEffect } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Preferences } from '@capacitor/preferences';
import { db } from '@/firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Device } from '@capacitor/device';

export default function ScannerVincular() {
  const startScan = async () => {
    try {
      // 1. Verificar/Pedir permisos
      const permission = await BarcodeScanner.checkPermissions();
      if (permission.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      // 2. Iniciar escaneo rápido (ML Kit)
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const rawData = barcodes[0].displayValue;
        const data = JSON.parse(rawData); // {InstitutoId, aulaId, rol}

        const info = await Device.getId();
        const deviceId = info.identifier;

        // 3. Guardar en Storage para el Java (MainActivity)
        await Preferences.set({
          key: 'InstitutoId',
          value: data.InstitutoId
        });

        // 4. Registrar en Firebase
        await setDoc(doc(db, "dispositivos", deviceId), {
          id: deviceId,
          InstitutoId: data.InstitutoId,
          aulaId: data.aulaId,
          rol: data.rol,
          status: 'pending_name',
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        }, { merge: true });

        alert("VINCOLO EXITOSO. Protegiendo dispositivo...");
        window.location.reload();
      }
    } catch (e) {
      console.error("Error en Scanner:", e);
    }
  };

  useEffect(() => {
    startScan();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black">
      <div className="p-8 border-2 border-orange-500 rounded-3xl text-center bg-slate-900">
        <h2 className="text-white font-black uppercase italic">EFAS <span className="text-orange-500">ServiControlPro</span></h2>
        <p className="text-slate-400 text-[10px] mt-4 uppercase">Escaneando...</p>
      </div>
    </div>
  );
}
