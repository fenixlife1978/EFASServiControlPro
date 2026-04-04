import { db } from '@/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Configuración de qué colecciones van a cada lado
const COLLECTION_ROUTES = {
  firebase: [
    'dispositivos',
    'usuarios', 
    'users',
    'system_config',
    'institutions',
    'config'
  ],
  local: [
    'heartbeats',
    'activity_logs',
    'web_history',
    'incidencias',
    'alertas'
  ]
};

export const dbService = {
  // Obtiene la configuración guardada por el usuario
  getSettings() {
    if (typeof window === 'undefined') {
      return { mode: 'firebase', url: '' };
    }
    return JSON.parse(localStorage.getItem('app_config') || '{"mode":"firebase","url":""}');
  },

  // Guarda la configuración
  saveSettings(mode, url = '') {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_config', JSON.stringify({ mode, url }));
    }
  },

  // ============================================================
  // NUEVO: Obtener incidencias de un dispositivo específico
  // ============================================================
  async getIncidencias(deviceId) {
    const { mode, url } = this.getSettings();

    // 🔒 PROTECCIÓN: Si no es Firebase y no hay URL, usar Firebase (fallback)
    if (mode !== 'firebase' && !url) {
      console.warn(`⚠️ Modo "${mode}" sin URL configurada. Usando Firebase como fallback.`);
      return await this.fetchIncidenciasFirebase(deviceId);
    }

    if (mode === 'firebase') {
      return await this.fetchIncidenciasFirebase(deviceId);
    }

    if (mode === 'local') {
      return await this.fetchIncidenciasLocal(url, deviceId);
    }

    if (mode === 'hibrido' || mode === 'hybrid') {
      // En híbrido, las incidencias están en la lista 'local', así que van al servidor local
      return await this.fetchIncidenciasLocal(url, deviceId);
    }

    return await this.fetchIncidenciasFirebase(deviceId);
  },

  async fetchIncidenciasFirebase(deviceId) {
    try {
      const incidenciasRef = collection(db, 'dispositivos', deviceId, 'incidencias');
      const q = query(incidenciasRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
      }));
    } catch (error) {
      console.error(`Error obteniendo incidencias de Firebase para dispositivo ${deviceId}:`, error);
      return [];
    }
  },

  async fetchIncidenciasLocal(url, deviceId) {
    try {
      const response = await fetch(`${url}/api/incidencias?deviceId=${deviceId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error obteniendo incidencias del servidor local para dispositivo ${deviceId}:`, error);
      return [];
    }
  },

  // ============================================================
  // Métodos existentes (sin cambios)
  // ============================================================
  async getData(collectionName) {
    const { mode, url } = this.getSettings();

    if (mode !== 'firebase' && !url) {
      console.warn(`⚠️ Modo "${mode}" sin URL configurada. Usando Firebase como fallback.`);
      return await this.fetchFirebase(collectionName);
    }

    if (mode === 'firebase') {
      return await this.fetchFirebase(collectionName);
    }
    
    if (mode === 'local') {
      return await this.fetchExternal(url, collectionName);
    }
    
    if (mode === 'hibrido' || mode === 'hybrid') {
      return await this.fetchHybrid(collectionName, url);
    }
    
    return await this.fetchFirebase(collectionName);
  },

  async fetchFirebase(collectionName) {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error en Firebase (${collectionName}):`, error);
      return [];
    }
  },

  async fetchExternal(url, collectionName) {
    try {
      const response = await fetch(`${url}/api/${collectionName}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error conectando a servidor local (${collectionName}):`, error);
      return [];
    }
  },

  async fetchHybrid(collectionName, url) {
    if (COLLECTION_ROUTES.firebase.includes(collectionName)) {
      return await this.fetchFirebase(collectionName);
    }
    
    if (COLLECTION_ROUTES.local.includes(collectionName)) {
      return await this.fetchExternal(url, collectionName);
    }
    
    try {
      return await this.fetchFirebase(collectionName);
    } catch (firebaseError) {
      console.warn(`Fallback a servidor local para ${collectionName}`);
      return await this.fetchExternal(url, collectionName);
    }
  },

  async sendData(collectionName, data, method = 'POST') {
    const { mode, url } = this.getSettings();
    
    if (mode !== 'firebase' && !url) {
      console.warn(`⚠️ Modo "${mode}" sin URL. No se puede enviar datos.`);
      return { success: false, error: 'URL no configurada' };
    }
    
    const comandosCriticos = ['bloquear', 'pinBloqueo', 'cortarNavegacion', 'shieldMode'];
    
    if (comandosCriticos.some(cmd => data.hasOwnProperty(cmd))) {
      console.log(`⚡ Comando crítico → Firebase`);
      return { success: true, mode: 'firebase' };
    }
    
    if (mode === 'firebase') {
      return { success: true, mode: 'firebase' };
    }
    
    if (mode === 'local') {
      return { success: true, mode: 'local' };
    }
    
    if (mode === 'hibrido' || mode === 'hybrid') {
      if (COLLECTION_ROUTES.firebase.includes(collectionName)) {
        return { success: true, mode: 'firebase' };
      } else {
        return { success: true, mode: 'local' };
      }
    }
    
    return { success: false, mode: 'unknown' };
  }
};


if (typeof window !== 'undefined') {
  (window).dbService = dbService;
}