import { db } from './firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

export const dbService = {
  // Obtiene la configuración guardada por el usuario en el Panel
  getSettings() {
    return JSON.parse(localStorage.getItem('app_config') || '{"mode":"firebase","url":""}');
  },

  async getData(collectionName) {
    const { mode, url } = this.getSettings();

    switch (mode) {
      case 'firebase':
        return await this.fetchFirebase(collectionName);
      case 'local':
      case 'custom':
        // Conexión dinámica a una URL/IP especificada por el usuario
        return await this.fetchExternal(url, collectionName);
      case 'hibrido':
        return await this.fetchHybrid(collectionName);
      default:
        return await this.fetchFirebase(collectionName);
    }
  },

  async fetchFirebase(collectionName) {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async fetchExternal(url, collectionName) {
    try {
      // Petición a servidor local o API externa
      const response = await fetch(`${url}/api/${collectionName}`);
      return await response.json();
    } catch (error) {
      console.error("Error conectando a servidor:", error);
      return [];
    }
  },

  async fetchHybrid(collectionName) {
    try {
      const data = await this.fetchFirebase(collectionName);
      localStorage.setItem(collectionName, JSON.stringify(data));
      return data;
    } catch (error) {
      console.warn("Firebase falló, recuperando datos offline...");
      return JSON.parse(localStorage.getItem(collectionName) || '[]');
    }
  }
};