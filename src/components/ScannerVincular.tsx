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
      // 1. Verificar/Pedir permisos de cámara
      const permission = await BarcodeScanner.checkPermissions();
      if (permission.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      // 2. Iniciar escaneo
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const rawData = barcodes[0].displayValue;
        // Esperamos: { "InstitutoId": "P2-001", "aulaId": "LABORATORIO", "role": "estudiante", "nombre": "Nombre Alumno", "seccion": "5TO B" }
        const data = JSON.parse(rawData); 

        // Obtener ID único del hardware (Funciona en Android/iOS/Web)
        const info = await Device.getId();
        const deviceId = info.identifier;

        // 3. Guardar en Storage local para persistencia y para el LockListener
        await Preferences.set({ key: 'InstitutoId', value: data.InstitutoId });
        localStorage.setItem('EDU_Device_ID', deviceId); // Vital para el bloqueo

        // 4. Registrar en Firebase según el Rol (Estructura EDUControlPro Sistema de Control Parental Educativo)
        
        // A. Siempre registrar en la raíz de dispositivos para el Super Admin
        await setDoc(doc(db, "dispositivos", deviceId), {
          deviceId: deviceId,
          InstitutoId: data.InstitutoId,
          aulaId: data.aulaId || "GENERAL",
          role: data.role,
          modelo: (await Device.getInfo()).model,
          vinculado: true,
          fechaVinculacion: serverTimestamp()
        }, { merge: true });

        // B. Registrar en la colección "usuarios" (la que lee el Panel del Profesor)
        const userRef = doc(db, "usuarios", deviceId);
        
        if (data.role === 'estudiante') {
          await setDoc(userRef, {
            nombre: data.nombre || "Alumno Nuevo",
            deviceId: deviceId,
            InstitutoId: data.InstitutoId,
            aulaId: data.aulaId,
            seccion: data.seccion || "S/S",
            role: "estudiante",
            bloqueado: false, // Por defecto desbloqueado
            status: "activo",
            ultimaConexion: serverTimestamp()
          }, { merge: true });
        } 
        else if (data.role === 'profesor') {
          await setDoc(userRef, {
            nombre: data.nombre || "Profesor Nuevo",
            InstitutoId: data.InstitutoId,
            aulaId: data.aulaId,
            role: "profesor",
            email: data.email || "",
            ultimaConexion: serverTimestamp()
          }, { merge: true });
        }

        alert("VINCULACIÓN EXITOSA. EDUControlPro Sistema de Control Parental Educativo Protegiendo...");
        window.location.href = "/"; // Redirigir al inicio o dashboard
      }
    } catch (e) {
      console.error("Error en Scanner:", e);
      alert("Error al vincular: Verifique el formato del código QR.");
    }
  };

  useEffect(() => {
    // Pequeño delay para asegurar que la cámara esté lista
    const timer = setTimeout(() => startScan(), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0f1117]">
      <div className="relative p-10 border-2 border-[#f97316]/30 rounded-[3rem] text-center bg-slate-900/50 backdrop-blur-xl">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#f97316] p-4 rounded-2xl shadow-lg shadow-[#f97316]/20">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        
        <h2 className="text-white text-xl font-black uppercase italic tracking-tighter mt-4">
          EDU <span className="text-[#f97316]">VINCULACIÓN</span>
        </h2>
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="w-12 h-1 bg-[#f97316] rounded-full animate-pulse"></div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
            Escaneando Credencial
          </p>
        </div>
      </div>
    </div>
  );
}
