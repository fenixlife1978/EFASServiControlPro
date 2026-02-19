import { Capacitor } from '@capacitor/core';
export const NativePlatforms = {
  isNative: () => Capacitor.isNativePlatform(),
  getPlatform: () => Capacitor.getPlatform(),
  scanQRCode: async () => ({ 
    text: '', 
    institutoId: '', 
    alumnoId: '', 
    nombreAlumno: '' 
  }),
  linkDevice: async (alumnoId: string, instId: string) => ({ success: true }),
};
