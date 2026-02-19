'use client';
import React, { useState, useEffect } from 'react';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';

export default function ScannerVincular() {
  const [loading, setLoading] = useState(false);

  const startScan = async () => {
    try {
      // 1. Pedir permiso
      const status = await BarcodeScanner.checkPermission({ force: true });
      if (!status.granted) return;

      // 2. Preparar la cámara (hace el fondo transparente para ver la cámara)
      await BarcodeScanner.hideBackground();
      document.querySelector('body')?.classList.add('scanner-active');
      
      setLoading(true);

      const result = await BarcodeScanner.startScan(); // Aquí se queda esperando el QR

      if (result.hasContent) {
        document.querySelector('body')?.classList.remove('scanner-active');
        const data = JSON.parse(result.content); // Esperamos {institutoId, alumnoId, nombre}
        
        // LLAMAMOS AL CÓDIGO JAVA QUE HICIMOS ANTES
        // Nota: Aquí usamos la comunicación Capacitor -> Java
        console.log("Datos recibidos del QR:", data);
        
        // Enviar a Firebase via la función nativa que creamos en MainActivity
        // (Asumiendo que ya tienes el puente configurado)
        alert("Vinculando a: " + data.nombreAlumno);
      }
    } catch (e) {
      console.error(e);
      stopScan();
    }
  };

  const stopScan = () => {
    BarcodeScanner.showBackground();
    BarcodeScanner.stopScan();
    document.querySelector('body')?.classList.remove('scanner-active');
  };

  useEffect(() => {
    startScan();
    return () => stopScan();
  }, []);

  return (
    <div className="flex flex-col items-center justify-end h-screen pb-20 bg-transparent">
      <div className="bg-black/80 p-6 rounded-3xl border border-orange-500 text-center">
        <h2 className="text-white font-black italic uppercase">EFAS <span className="text-orange-500">GuardianPro</span></h2>
        <p className="text-slate-400 text-xs mt-2">Apunte la cámara al código QR del Alumno</p>
        <button onClick={stopScan} className="mt-4 text-red-500 font-bold text-xs uppercase">Cancelar</button>
      </div>
    </div>
  );
}
