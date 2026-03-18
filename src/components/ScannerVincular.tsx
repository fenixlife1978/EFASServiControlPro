'use client';
import React, { useEffect, useState } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { db, rtdb } from '@/firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set, update as rtdbUpdate } from 'firebase/database';
import { Device } from '@capacitor/device';
import { Preferences } from '@capacitor/preferences';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';

export default function ScannerVincular() {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para escribir logs en RTDB (nodo global para depuración)
  const logToFirebase = async (tipo: string, detalle: string) => {
    try {
      const logRef = ref(rtdb, 'debug_logs_global');
      const newLogRef = ref(rtdb, `debug_logs_global/${Date.now()}`);
      await set(newLogRef, {
        tipo,
        detalle,
        timestamp: Date.now(),
        origen: 'ScannerVincular'
      });
    } catch (e) {
      console.error('Error al escribir log:', e);
    }
  };

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
      await logToFirebase('VINCULACION', 'Iniciando escaneo');

      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length === 0) {
        setError('No se detectó ningún código QR');
        await logToFirebase('VINCULACION_ERROR', 'No se detectó QR');
        setIsScanning(false);
        return;
      }

      const rawData = barcodes[0].displayValue;
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        setError('Formato de QR inválido');
        await logToFirebase('VINCULACION_ERROR', 'Formato JSON inválido');
        setIsScanning(false);
        return;
      }

      const deviceId = data.deviceId;
      const instId = data.InstitutoId || '';

      if (!deviceId) {
        setError('El QR no contiene deviceId');
        await logToFirebase('VINCULACION_ERROR', 'QR sin deviceId');
        setIsScanning(false);
        return;
      }

      await logToFirebase('VINCULACION', `Datos QR: deviceId=${deviceId}, instId=${instId}, rol=${data.rol}`);

      // Guardar en Preferences
      await Preferences.set({ key: 'deviceId', value: String(deviceId) });
      await Preferences.set({ key: 'InstitutoId', value: String(instId) });
      await Preferences.set({ key: 'aulaId', value: String(data.aulaId || '') });
      await Preferences.set({ key: 'seccion', value: String(data.seccion || '') });
      await Preferences.set({ key: 'rol', value: String(data.rol || 'alumno') });

      const info = await Device.getInfo();
      const idHardware = await Device.getId();

      // --- FIRESTORE: Crear documento en 'dispositivos' con todos los campos necesarios ---
      const deviceRef = doc(db, 'dispositivos', deviceId);
      try {
        console.log('📝 Escribiendo en Firestore:', deviceId);
        await logToFirebase('FIRESTORE', 'Iniciando escritura');

        const firestoreData: any = {
          vinculado: true,
          status: 'active',
          rol: data.rol || 'alumno',
          InstitutoId: instId,
          aulaId: data.aulaId || '',
          seccion: data.seccion || '',
          hardware: {
            modelo: info.model,
            marca: info.manufacturer,
            uuid: idHardware.identifier,
          },
          createdAt: serverTimestamp(),
          // Campos necesarios para la interfaz web:
          online: false, // Inicialmente offline
          ultimoAcceso: serverTimestamp(),
        };

        // Si el rol es 'alumno', añadir alumno_asignado vacío (la interfaz lo espera)
        if (data.rol === 'alumno') {
          firestoreData.alumno_asignado = 'Sin asignar';
        } else {
          firestoreData.alumno_asignado = ''; // Para profesores, directores, etc.
        }

        await setDoc(deviceRef, firestoreData, { merge: true });
        console.log('✅ Firestore OK');
        await logToFirebase('FIRESTORE', 'Escritura exitosa');
      } catch (e: any) {
        console.error('❌ Error en Firestore:', e);
        await logToFirebase('FIRESTORE_ERROR', `Código: ${e.code} - ${e.message}`);
        setError(`Error Firestore: ${e.code} - ${e.message}`);
        throw e;
      }

      // --- REALTIME DATABASE: Datos de presencia inmediata ---
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
          seccion: data.seccion || '',
        });
        await logToFirebase('RTDB', 'Escritura exitosa en dispositivos');
      } catch (e: any) {
        console.error('❌ Error en RTDB:', e);
        await logToFirebase('RTDB_ERROR', e.message);
        setError(`Error RTDB: ${e.message}`);
        throw e;
      }

      // Opcional: escribir en control_sedes (si se usa)
      if (instId) {
        const rtdbControlRef = ref(rtdb, `control_sedes/${instId}/dispositivos/${deviceId}`);
        try {
          await set(rtdbControlRef, {
            connected: true,
            locked: false,
            lastSeen: Date.now(),
            model: info.model,
          });
        } catch (e: any) {
          console.warn('⚠️ Error en control_sedes:', e);
        }
      }

      await Toast.show({ text: '✅ Tablet vinculada correctamente' });
      await logToFirebase('VINCULACION', 'Proceso completado con éxito');

      // Redirigir a la página principal después de un breve retraso
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (e: any) {
      console.error('🔥 Error crítico:', e);
      await logToFirebase('VINCULACION_ERROR_CRITICO', e.message);
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
            <p className="text-red-500 text-[11px] font-bold uppercase mb-2">⚠️ ERROR</p>
            <p className="text-slate-400 text-[10px] break-words whitespace-pre-wrap">{error}</p>
          </div>
        ) : (
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">
            {isScanning ? 'ESCANEANDO...' : 'PREPARANDO CÁMARA...'}
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
