import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const reportSecurityEvent = async (workingCondoId: string, deviceId: string, type: 'UNINSTALL_ATTEMPT' | 'LOCK_BYPASS') => {
  try {
    await addDoc(collection(db, 'security_alerts'), {
      workingCondoId,
      deviceId,
      type,
      timestamp: serverTimestamp(),
      status: 'CRITICAL',
      adminNotified: 'vallecondo@gmail.com'
    });
    console.log("Alerta de seguridad enviada a EFAS ServiControlPro");
  } catch (error) {
    console.error("Error reportando evento:", error);
  }
};
