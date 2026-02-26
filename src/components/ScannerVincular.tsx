'use client';
import React, { useEffect } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Preferences } from '@capacitor/preferences';
import { db } from '@/firebase/config';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Device } from '@capacitor/device';

export default function ScannerVincular() {
  const startScan = async () => {
    try {
      // 1. Permisos de Cámara
      const permission = await BarcodeScanner.checkPermissions();
      if (permission.camera !== 'granted') {
        const request = await BarcodeScanner.requestPermissions();
        if (request.camera !== 'granted') {
          alert("Permiso de cámara denegado");
          return;
        }
      }

      // 2. Ejecutar Escaneo
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const rawData = barcodes[0].displayValue;
        const data = JSON.parse(rawData); 

        // 3. Identificación del Dispositivo y Rol
        const deviceId = data.deviceId;
        const targetRol = data.rol || 'alumno'; 
        if (!deviceId) throw new Error("QR sin DeviceID del Panel");

        const info = await Device.getInfo();
        const idHardware = await Device.getId();

        // 4. Persistencia Local en la Tablet
        await Preferences.set({ key: 'InstitutoId', value: data.InstitutoId });
        await Preferences.set({ key: 'deviceId', value: deviceId });
        await Preferences.set({ key: 'userRol', value: targetRol });
        localStorage.setItem('EDU_Device_ID', deviceId);

        // 5. Sincronización con Firebase (Documento generado por Super Admin)
        const deviceRef = doc(db, "dispositivos", deviceId);
        await updateDoc(deviceRef, {
          vinculado: true,
          status: 'active',
          rol: targetRol,
          hardware: {
            modelo: info.model,
            marca: info.manufacturer,
            uuid_real: idHardware.identifier
          },
          lastUpdated: serverTimestamp()
        });

        // 6. Registro en la Jurisdicción (Colección usuarios)
        await setDoc(doc(db, "usuarios", deviceId), {
          nombre: targetRol === 'profesor' ? "Profesor Asignado" : "Alumno Asignado",
          deviceId: deviceId,
          InstitutoId: data.InstitutoId,
          aulaId: data.aulaId,
          seccion: data.seccion,
          rol: targetRol,
          bloqueado: false,
          status: "active",
          ultimaConexion: serverTimestamp()
        }, { merge: true });

        alert(`✅ VINCULACIÓN EXITOSA: ${targetRol.toUpperCase()}`);
        window.location.href = "/";
      }
    } catch (e) {
      console.error("Error de vinculación:", e);
      alert("❌ ERROR: El código QR no es compatible con el sistema central.");
    }
  };

  useEffect(() => {
    // Delay de seguridad para que el motor de la cámara inicie limpio
    const timer = setTimeout(() => startScan(), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0f1117]">
      <div className="relative p-12 border-2 border-orange-500/20 rounded-[4rem] text-center bg-slate-900/40 backdrop-blur-2xl">
        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-orange-500/30">
          <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping" />
        </div>
        <h2 className="text-white text-2xl font-black uppercase italic tracking-tighter">
          EDU <span className="text-orange-500">SCANNER</span>
        </h2>
        <p className="text-slate-500 text-[9px] font-black mt-4 uppercase tracking-[0.4em]">
          Buscando Señal del Panel...
        </p>
      </div>
    </div>
  );
}
