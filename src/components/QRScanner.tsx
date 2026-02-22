'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Camera } from '@capacitor/camera';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
// Este import depende de cómo tengas configurada la comunicación con nativo
import { NativePlatforms } from '@/plugins/native-platforms'; 

export default function QRScanner() {
  const [isScanning, setIsScanning] = useState(false);

  const startScanning = async () => {
    // 1. Verificar si estamos en Android
    if (Capacitor.getPlatform() !== 'android') {
      Toast.show({ text: 'El escáner solo funciona en Android' });
      return;
    }

    try {
      setIsScanning(true);
      // 2. Abrir la cámara nativa (simulado aquí, necesitas el plugin de QR)
      // Supongamos que tu plugin devuelve un objeto con: institutoId, alumnoId, nombreAlumno
      const result = await NativePlatforms.scanQRCode();
      
      if (result) {
        // 3. LLAMAR AL MÉTODO NATIVO QUE CREAMOS EN MainActivity.java
        await NativePlatforms.linkDevice(
          result.institutoId,
          result.alumnoId,
          
        );
        
        Toast.show({ text: 'Tablet vinculada correctamente' });
      }
    } catch (error) {
      console.error(error);
      Toast.show({ text: 'Error al escanear' });
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    // Iniciar escáner automáticamente al abrir
    startScanning();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0c10] text-white">
      <div className="text-center p-10">
        <h2 className="text-2xl font-bold mb-4">Vinculación EDU</h2>
        <p className="text-slate-400 mb-8">Escanea el QR de la tablet</p>
        <button 
          onClick={startScanning}
          className="bg-orange-500 px-6 py-3 rounded-xl font-bold"
        >
          {isScanning ? 'Escaneando...' : 'Abrir Cámara'}
        </button>
      </div>
    </div>
  );
}
