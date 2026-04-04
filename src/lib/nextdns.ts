// lib/nextdns.ts
// Utilidad para comunicarse con la API de NextDNS

const PROFILE_ID = '857b18'; // Tu ID de perfil de NextDNS

// Obtener la API Key desde variables de entorno
const getApiKey = (): string => {
  const apiKey = process.env.NEXTDNS_API_KEY;
  if (!apiKey) {
    throw new Error('NEXTDNS_API_KEY no está configurada en .env.local');
  }
  return apiKey;
};

// Headers comunes para todas las peticiones a NextDNS
const getHeaders = () => ({
  'X-Api-Key': getApiKey(),
  'Content-Type': 'application/json',
});

// URL base de la API de NextDNS
const API_BASE_URL = 'https://api.nextdns.io';

/**
 * Añadir un dominio a la lista negra (denylist)
 * @param domain - El dominio a bloquear (ej: "twitter.com")
 */
export async function addToDenylist(domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/profiles/${PROFILE_ID}/denylist`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id: domain, active: true }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error al añadir a denylist:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error en addToDenylist:', error);
    return false;
  }
}

/**
 * Eliminar un dominio de la lista negra (denylist)
 * @param domain - El dominio a desbloquear
 */
export async function removeFromDenylist(domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/profiles/${PROFILE_ID}/denylist/${domain}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error al eliminar de denylist:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error en removeFromDenylist:', error);
    return false;
  }
}

/**
 * Añadir un dominio a la lista blanca (allowlist)
 * @param domain - El dominio a permitir
 */
export async function addToAllowlist(domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/profiles/${PROFILE_ID}/allowlist`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ id: domain, active: true }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error al añadir a allowlist:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error en addToAllowlist:', error);
    return false;
  }
}

/**
 * Eliminar un dominio de la lista blanca (allowlist)
 * @param domain - El dominio a quitar de la lista blanca
 */
export async function removeFromAllowlist(domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/profiles/${PROFILE_ID}/allowlist/${domain}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error al eliminar de allowlist:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error en removeFromAllowlist:', error);
    return false;
  }
}

/**
 * Obtener todos los dominios bloqueados (denylist)
 * @returns Array de dominios bloqueados o null si hay error
 */
export async function getDenylist(): Promise<string[] | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/profiles/${PROFILE_ID}/denylist`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error al obtener denylist:', error);
      return null;
    }
    
    const data = await response.json();
    // La respuesta es un array de objetos con la propiedad 'id'
    return data.map((item: any) => item.id);
  } catch (error) {
    console.error('Error en getDenylist:', error);
    return null;
  }
}

/**
 * Obtener todos los dominios permitidos (allowlist)
 * @returns Array de dominios permitidos o null si hay error
 */
export async function getAllowlist(): Promise<string[] | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/profiles/${PROFILE_ID}/allowlist`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error al obtener allowlist:', error);
      return null;
    }
    
    const data = await response.json();
    return data.map((item: any) => item.id);
  } catch (error) {
    console.error('Error en getAllowlist:', error);
    return null;
  }
}