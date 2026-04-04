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
      await Toast.show({ text: '📱 Iniciando escáner...', duration: 'short' });

      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        await Toast.show({ text: '📷 Solicitando permiso de cámara...', duration: 'short' });
        await BarcodeScanner.requestPermissions();
      }

      await Toast.show({ text: '🔍 Escaneando QR...', duration: 'short' });
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length === 0) {
        await Toast.show({ text: '❌ No se detectó QR', duration: 'short' });
        setIsScanning(false);
        return;
      }

      const rawData = barcodes[0].displayValue;
      await Toast.show({ text: `📄 QR detectado`, duration: 'short' });
      
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        await Toast.show({ text: '❌ Formato de QR inválido', duration: 'long' });
        setError('Formato de QR inválido');
        setIsScanning(false);
        return;
      }

      // --- CORRECCIÓN CRÍTICA: LIMPIEZA DE DATOS (TRIM) ---
      // Esto asegura que IDs con espacios no rompan las reglas de Firebase
      const deviceId = String(data.deviceId || data.id || '').trim();
      const instId = String(data.InstitutoId || data.inst || '').trim();
      const cleanAula = String(data.aulaId || data.aula || '').trim().toUpperCase();
      const cleanSeccion = String(data.seccion || '').trim().toUpperCase();
      const rol = String(data.rol || 'alumno').toLowerCase().trim();

      if (!deviceId) {
        await Toast.show({ text: '❌ QR sin deviceId', duration: 'long' });
        setError('El QR no contiene deviceId');
        setIsScanning(false);
        return;
      }

      await Toast.show({ text: `✅ Procesando: ${deviceId}`, duration: 'short' });

      // Verificar action
      if (data.action && data.action !== 'vincular' && data.action !== 'enroll') {
        await Toast.show({ text: `❌ Action no válida: ${data.action}`, duration: 'long' });
        setError('QR no compatible con EDUControlPro');
        setIsScanning(false);
        return;
      }

      await Toast.show({ text: '💾 Guardando localmente...', duration: 'short' });

      // Guardar localmente (Preferences)
      await Preferences.set({ key: 'deviceId', value: deviceId });
      await Preferences.set({ key: 'InstitutoId', value: instId });
      await Preferences.set({ key: 'aulaId', value: cleanAula });
      await Preferences.set({ key: 'seccion', value: cleanSeccion });
      await Preferences.set({ key: 'rol', value: rol });

      const info = await Device.getInfo();
      const idHardware = await Device.getId();

      await Toast.show({ text: '☁️ Sincronizando Firebase...', duration: 'short' });

      // 1. FIRESTORE
      const deviceRef = doc(db, 'dispositivos', deviceId);
      const deviceData = {
        id: deviceId,
        vinculado: true,
        status: 'active',
        rol: rol,
        InstitutoId: instId,
        aulaId: cleanAula,
        seccion: cleanSeccion,
        alumno_asignado: rol === 'alumno' ? 'Sin asignar' : '',
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

      try {
        await setDoc(deviceRef, deviceData, { merge: true });
        console.log("✅ Firestore OK");
      } catch (fsError: any) {
        console.error("❌ Firestore Error:", fsError);
        await Toast.show({ text: '⚠️ Error Firestore (Permisos)', duration: 'short' });
      }

      // 2. RTDB (Estructura para MainActivity.java)
      try {
        // Nodo Principal
        const rtdbRef = ref(rtdb, `dispositivos/${deviceId}`);
        await set(rtdbRef, {
          id: deviceId,
          InstitutoId: instId,
          alumno_asignado: rol === 'alumno' ? 'Sin asignar' : '',
          online: true,
          lastPulse: Date.now(),
          lastSeen: Date.now(),
          estado: "activo",
          vinculado: true,
          rol: rol,
          createdAt: Date.now(),
          aulaId: cleanAula,
          seccion: cleanSeccion,
          hardware: {
            aulaId: cleanAula,
            seccion: cleanSeccion,
            modelo: info.model,
            marca: info.manufacturer,
            uuid: idHardware.identifier,
          }
        });
        
        // Nodo de Estatus (Escuchado por el Service nativo)
        const statusRef = ref(rtdb, `status_dispositivos/${deviceId}`);
        await set(statusRef, {
          lastSeen: Date.now(),
          url_actual: 'Esperando navegación...',
          estado: 'activo',
          shield_mode_enable: true, // Activamos por defecto al vincular
          admin_mode_enable: false,
          block_mode: false,
          InstitutoId: instId,
          aulaId: cleanAula,
          seccion: cleanSeccion,
          alumno_asignado: rol === 'alumno' ? 'Sin asignar' : '',
          rol: rol,
          lastUpdated: Date.now()
        });
        
        await Toast.show({ text: '✅ VINCULACIÓN EXITOSA', duration: 'long' });
      } catch (rtdbError: any) {
        console.error("❌ RTDB Error:", rtdbError);
        await Toast.show({ text: '⚠️ Error RTDB (Verifica Reglas)', duration: 'long' });
      }

      setTimeout(() => {
        window.location.href = '/';
      }, 1500);

    } catch (e: any) {
      console.error("Error general:", e);
      setError(`Error: ${e.message}`);
      await Toast.show({ text: `❌ Error: ${e.message}`, duration: 'long' });
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
