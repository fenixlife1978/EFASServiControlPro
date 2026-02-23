import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.educontrolpro',
  appName: 'EDUControlPro',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    errorPath: 'index.html'
  }
};

export default config;
