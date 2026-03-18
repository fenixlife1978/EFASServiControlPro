import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.educontrolpro',
  appName: 'EDUControlPro',
  webDir: 'public', // <-- Cambiado temporalmente
  server: {
    androidScheme: 'https',
    errorPath: 'index.html'
  }
};

export default config;
