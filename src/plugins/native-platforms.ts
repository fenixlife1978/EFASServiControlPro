import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export const NativePlatforms = {
  // Verificar si es plataforma nativa
  isNative: () => Capacitor.isNativePlatform(),
  
  // Obtener plataforma actual
  getPlatform: () => Capacitor.getPlatform(),
  
  // Escanear código QR usando ML Kit
  scanQRCode: async () => {
    try {
      // Verificar permisos
      const status = await BarcodeScanner.checkPermissions();
      if (status.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }

      // Escanear
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length === 0) {
        throw new Error('No se detectó ningún código QR');
      }

      const rawData = barcodes[0].displayValue;
      
      // Intentar parsear como JSON
      try {
        const data = JSON.parse(rawData);
        return {
          text: rawData,
          institutoId: data.InstitutoId || data.institutoId || '',
          alumnoId: data.alumnoId || data.deviceId || '',
          nombreAlumno: data.nombreAlumno || data.alumno_asignado || ''
        };
      } catch (e) {
        // Si no es JSON, devolver el texto plano
        return {
          text: rawData,
          institutoId: '',
          alumnoId: '',
          nombreAlumno: ''
        };
      }
    } catch (error) {
      console.error('Error escaneando QR:', error);
      throw error;
    }
  },
  
  // Obtener información del dispositivo
  getDeviceInfo: async () => {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    const id = await Device.getId();
    
    return {
      modelo: info.model,
      marca: info.manufacturer,
      uuid: id.identifier,
      plataforma: info.platform,
      version: info.osVersion
    };
  }
};