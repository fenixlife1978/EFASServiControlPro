import { db } from '@/firebase'; // Asegúrate de que la ruta sea @/firebase o @/firebase/config según tu proyecto
import { doc, onSnapshot } from 'firebase/firestore';

export const subscribeToMasterKey = (callback: (key: string) => void) => {
  const securityDoc = doc(db, 'system_config', 'security');
  
  // Usamos onSnapshot para que los cambios sean instantáneos (tiempo real)
  return onSnapshot(securityDoc, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      
      // 🔥 CORREGIDO: El campo es 'master_pin', no 'master_key'
      if (data && data.master_pin) {
        callback(data.master_pin);
        console.log("✅ PIN maestro sincronizado desde Firebase");
      } else {
        console.warn("⚠️ El documento existe pero el campo 'master_pin' está vacío o falta.");
      }
    } else {
      console.warn("⚠️ No se encontró el documento de seguridad en /system_config/security");
    }
  }, (error) => {
    // Esto es vital para evitar el error de "Cloud Firestore backend could not be reached"
    console.error("❌ Error de conexión con Firestore en el servicio de seguridad:", error);
  });
};
