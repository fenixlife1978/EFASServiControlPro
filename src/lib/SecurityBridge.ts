import { App } from '@capacitor/app';
import { reportSecurityEvent } from './security-service';

// No necesitas importar Plugins, usa registerPlugin si es necesario
// import { registerPlugin } from '@capacitor/core';

export const initializeSecurityBridge = (lockCallback: (state: boolean) => void) => {
  console.log('🔐 Puente de seguridad activo');

  // 1. Detectar cambios de estado de la app
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      console.log('📱 App en segundo plano - Monitoreando seguridad');
      lockCallback(false);
    } else {
      console.log('📱 App en primer plano');
      lockCallback(true);
    }
  });

  // 2. Detectar cuando la app es abierta desde un deep link
  App.addListener('appUrlOpen', (data) => {
    console.log('🔗 URL abierta:', data.url);
    
    if (data.url.includes('action=rebloquear')) {
      console.log('🔒 Comando de rebloqueo recibido');
      
      // Intentar llamar al plugin nativo si existe
      try {
        // En lugar de Plugins, usa window si el plugin expone algo global
        const LiberarPlugin = (window as any).LiberarPlugin;
        if (LiberarPlugin?.ejecutarRebloqueo) {
          LiberarPlugin.ejecutarRebloqueo();
        }
      } catch (e) {
        console.error('Error ejecutando rebloqueo:', e);
      }
      
      lockCallback(false);
    }
  });

  // 3. Reportar inicialización (necesita institutionId y deviceId)
  // NOTA: Esta función necesita 3 argumentos, por eso está comentada
  // Si quieres reportar, necesitas obtener institutionId y deviceId primero
  /*
  const institutionId = localStorage.getItem('InstitutoId') || '';
  const deviceId = localStorage.getItem('deviceId') || '';
  if (institutionId && deviceId) {
    reportSecurityEvent(institutionId, deviceId, 'LOCK_BYPASS');
  }
  */
};

// Función para reportar intentos de desinstalación
export const reportUninstallAttempt = (institutionId: string, deviceId: string) => {
  console.log('⚠️ Intento de desinstalación detectado');
  
  // Llamar a reportSecurityEvent con los parámetros correctos
  reportSecurityEvent(institutionId, deviceId, 'UNINSTALL_ATTEMPT');
  
  // Guardar en localStorage para persistir el estado
  if (typeof window !== 'undefined') {
    localStorage.setItem('security_breach', Date.now().toString());
  }
};