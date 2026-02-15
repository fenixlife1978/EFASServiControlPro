import { db } from '@/firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

export const subscribeToMasterKey = (callback: (key: string) => void) => {
  const securityDoc = doc(db, 'system_config', 'security');
  
  // Usamos onSnapshot para que los cambios sean instantáneos (tiempo real)
  return onSnapshot(securityDoc, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data.master_key);
      console.log("Configuración de seguridad de EFAS sincronizada");
    } else {
      console.warn("No se encontró el documento de seguridad en Firestore");
    }
  });
};
