'use client';
import { FirestorePermissionError, RTDBPermissionError } from '@/firebase/errors';

/**
 * Define la estructura de todos los eventos posibles y sus tipos de datos asociados.
 * Centralizado para soportar el modelo híbrido: Firestore + Realtime Database.
 */
export interface AppEvents {
  'permission-error': FirestorePermissionError;   // Errores de documentos (Firestore)
  'rtdb-permission-error': RTDBPermissionError;    // Errores de comandos/bloqueos (RTDB)
}

// Tipo genérico para las funciones callback.
type Callback<T> = (data: T) => void;

/**
 * Un emisor de eventos pub/sub con tipado fuerte.
 * Utiliza el mapa de interfaces AppEvents para garantizar la integridad de los datos.
 */
function createEventEmitter<T extends Record<string, any>>() {
  // Almacena los callbacks indexados por el nombre del evento.
  const events: { [K in keyof T]?: Array<Callback<T[K]>> } = {};

  return {
    /**
     * Suscribirse a un evento.
     * @param eventName Nombre del evento definido en AppEvents.
     * @param callback Función que se ejecutará al emitirse el evento.
     */
    on<K extends keyof T>(eventName: K, callback: Callback<T[K]>) {
      if (!events[eventName]) {
        events[eventName] = [];
      }
      events[eventName]?.push(callback);
    },

    /**
     * Cancelar la suscripción a un evento.
     * @param eventName Nombre del evento.
     * @param callback Referencia de la función a eliminar.
     */
    off<K extends keyof T>(eventName: K, callback: Callback<T[K]>) {
      if (!events[eventName]) {
        return;
      }
      events[eventName] = events[eventName]?.filter(cb => cb !== callback);
    },

    /**
     * Publicar un evento a todos los suscriptores.
     * @param eventName Nombre del evento.
     * @param data Payload que corresponde al tipo definido en la interfaz.
     */
    emit<K extends keyof T>(eventName: K, data: T[K]) {
      if (!events[eventName]) {
        // Log de advertencia para detectar emisiones huérfanas durante el desarrollo
        console.warn(`[EventEmitter] El evento '${String(eventName)}' se emitió pero no tiene suscriptores activos.`);
        return;
      }
      events[eventName]?.forEach(callback => callback(data));
    },
  };
}

/**
 * Singleton del emisor de errores exportado para uso global en la aplicación.
 * Tipado con la interfaz AppEvents para prevenir errores de asignación.
 */
export const errorEmitter = createEventEmitter<AppEvents>();
