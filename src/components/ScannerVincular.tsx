'use client';
import React, { useEffect, useState } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { db, rtdb } from '@/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set, update as rtdbUpdate } from 'firebase/database';
// 🔥 CORRECCIÓN ERROR 2307: El import correcto es '@capacitor/device'
import { Device } from '@capacitor/device'; 
import { Preferences } from '@capacitor/preferences';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { FirestorePermissionError, RTDBPermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export default function ScannerVincular() {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScan = async () => {
    // 1. Verificar plataforma
    if (Capacitor.getPlatform() !== 'android') {
      const msg = 'El escáner solo funciona en dispositivos Android';
      setError(msg);
      await Toast.show({ text: msg });
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      
      // 2. Permisos
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      // 3. Escaneo
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length === 0) {
        setError('No se detectó ningún código QR');
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

      const deviceId = data.deviceId;
      const instId = data.InstitutoId || '';

      if (!deviceId) {
        setError('El QR no contiene deviceId');
        setIsScanning(false);
        return;
      }

      // 4. PERSISTENCIA LOCAL (Preferences)
      await Preferences.set({ key: 'deviceId', value: String(deviceId) });
      await Preferences.set({ key: 'InstitutoId', value: String(instId) });
      await Preferences.set({ key: 'aulaId', value: String(data.aulaId || '') });
      await Preferences.set({ key: 'seccion', value: String(data.seccion || '') });
      await Preferences.set({ key: 'rol', value: String(data.rol || 'alumno') });

      // 5. INFO HARDWARE
      const info = await Device.getInfo();
      const idHardware = await Device.getId();

      // --- OPERACIÓN HÍBRIDA OPTIMIZADA ---

      // 6. FIRESTORE: SOLO DATOS PERMANENTES (1 sola escritura)
      const deviceRef = doc(db, "dispositivos", deviceId);
      try {
        await updateDoc(deviceRef, {
          vinculado: true,
          status: 'active',
          rol: data.rol || 'alumno',
          InstitutoId: instId,
          aulaId: data.aulaId || '',
          seccion: data.seccion || '',
          hardware: { 
            modelo: info.model, 
            marca: info.manufacturer, 
            uuid: idHardware.identifier 
          },
          // ✅ NO PONER "online", "ultimoAcceso" AQUÍ (van a RTDB)
        });
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `dispositivos/${deviceId}`,
            operation: 'update'
          }));
        }
        throw e;
      }

      // 7. REALTIME DATABASE: DATOS VOLÁTILES (miles de escrituras)
      // Ruta directa para el dispositivo (más simple que control_sedes)
      const rtdbDeviceRef = ref(rtdb, `dispositivos/${deviceId}`);
      
      try {
        await set(rtdbDeviceRef, {
          online: true,
          url_actual: '',
          lastSeen: Date.now(),
          bloqueado: false,
          modelo: info.model,
          institutoId: instId,
          aulaId: data.aulaId || '',
          seccion: data.seccion || ''
        });
      } catch (e: any) {
        errorEmitter.emit('rtdb-permission-error', new RTDBPermissionError({
          path: `dispositivos/${deviceId}`,
          operation: 'write',  // 'write' es el valor permitid,
          requestResourceData: { online: true }
        }));
        throw e;
      }

      // 8. También mantener control_sedes para compatibilidad (opcional)
      if (instId) {
        const rtdbControlRef = ref(rtdb, `control_sedes/${instId}/dispositivos/${deviceId}`);
        try {
          await rtdbUpdate(rtdbControlRef, {
            connected: true,
            locked: false,
            lastSeen: Date.now(),
            model: info.model
          });
        } catch (e: any) {
          // No crítico si falla
          console.warn("Error en control_sedes:", e);
        }
      }

      await Toast.show({ text: '✅ Tablet vinculada correctamente' });
      
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);

    } catch (e: any) {
      console.error("Error crítico de vinculación:", e);
      setError(e.message || 'Error al vincular');
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
            <p className="text-red-500 text-[11px] font-bold uppercase mb-2">⚠️ ERROR DE SISTEMA</p>
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
            className="bg-orange-500 disabled:bg-slate-800 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-wider hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
          >
            {isScanning ? 'PROCESANDO...' : 'REINTENTAR'}
          </button>
        )}
      </div>
    </div>
  );
}
