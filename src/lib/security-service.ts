import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const reportSecurityEvent = async (
  institutionId: string, 
  deviceId: string, 
  type: 'UNINSTALL_ATTEMPT' | 'LOCK_BYPASS' | 'PIN_FAILED'
) => {
  if (!institutionId || !deviceId) {
    console.error("❌ reportSecurityEvent: Faltan datos requeridos");
    return;
  }

  try {
    await addDoc(collection(db, 'security_alerts'), {
      InstitutoId: institutionId,        // ← Cambiado para coincidir con tu DB
      deviceId: deviceId,
      type: type,
      timestamp: serverTimestamp(),
      status: 'CRITICAL',
      adminNotified: 'vallecondo@gmail.com',
      createdAt: new Date().toISOString()
    });
    
    console.log("✅ Alerta de seguridad enviada a EDUControlPro:", type);
    
    // También guardar en activity_logs para tracking
    await addDoc(collection(db, 'activity_logs'), {
      InstitutoId: institutionId,
      deviceId: deviceId,
      action: 'SECURITY_ALERT',
      details: type,
      timestamp: serverTimestamp()
    });
    
  } catch (error) {
    console.error("❌ Error reportando evento:", error);
  }
};

// Función adicional para reportar intentos de desinstalación específicamente
export const reportUninstallAttempt = async (institutionId: string, deviceId: string) => {
  return reportSecurityEvent(institutionId, deviceId, 'UNINSTALL_ATTEMPT');
};

// Función para reportar bypass de bloqueo
export const reportLockBypass = async (institutionId: string, deviceId: string) => {
  return reportSecurityEvent(institutionId, deviceId, 'LOCK_BYPASS');
};