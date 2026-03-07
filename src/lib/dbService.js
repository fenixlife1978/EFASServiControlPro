import { db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

// Configuración de qué colecciones van a cada lado
const COLLECTION_ROUTES = {
  firebase: [
    'dispositivos',
    'usuarios', 
    'users',              // ← AÑADIDA: colección del superadmin
    'system_config',
    'institutions',
    'config'              // ← AÑADIDA: para app_settings y app_status
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

  // Método principal con PROTECCIÓN
  async getData(collectionName) {
    const { mode, url } = this.getSettings();

    // 🔒 PROTECCIÓN: Si no es Firebase y no hay URL, usar Firebase
    if (mode !== 'firebase' && !url) {
      console.warn(`⚠️ Modo "${mode}" sin URL configurada. Usando Firebase como fallback.`);
      return await this.fetchFirebase(collectionName);
    }

    // Modo Firebase puro
    if (mode === 'firebase') {
      return await this.fetchFirebase(collectionName);
    }
    
    // Modo Local puro
    if (mode === 'local') {
      return await this.fetchExternal(url, collectionName);
    }
    
    // Modo Híbrido (inteligente)
    if (mode === 'hibrido') {
      return await this.fetchHybrid(collectionName, url);
    }
    
    // Por defecto, Firebase
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
    // 1. Si es colección crítica → Firebase
    if (COLLECTION_ROUTES.firebase.includes(collectionName)) {
      return await this.fetchFirebase(collectionName);
    }
    
    // 2. Si es colección de carga pesada → Servidor local
    if (COLLECTION_ROUTES.local.includes(collectionName)) {
      return await this.fetchExternal(url, collectionName);
    }
    
    // 3. Si no está clasificada, intenta Firebase con fallback a local
    try {
      return await this.fetchFirebase(collectionName);
    } catch (firebaseError) {
      console.warn(`Fallback a servidor local para ${collectionName}`);
      return await this.fetchExternal(url, collectionName);
    }
  },

  // Para escrituras (con protección también)
  async sendData(collectionName, data, method = 'POST') {
    const { mode, url } = this.getSettings();
    
    // 🔒 PROTECCIÓN: Si no es Firebase y no hay URL, advertir y no hacer nada
    if (mode !== 'firebase' && !url) {
      console.warn(`⚠️ Modo "${mode}" sin URL. No se puede enviar datos.`);
      return { success: false, error: 'URL no configurada' };
    }
    
    // Los comandos SIEMPRE van a Firebase (para que la APK los reciba)
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
    
    if (mode === 'hibrido') {
      if (COLLECTION_ROUTES.firebase.includes(collectionName)) {
        return { success: true, mode: 'firebase' };
      } else {
        return { success: true, mode: 'local' };
      }
    }
    
    return { success: false, mode: 'unknown' };
  }
};