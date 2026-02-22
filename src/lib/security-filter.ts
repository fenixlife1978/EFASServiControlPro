/**
 * EDUControlPro - Security Filter Logic
 * Compara una URL visitada contra las reglas de la institución.
 * Soporta Modo Normal (Blacklist) y Modo Estricto (Whitelist).
 */

export const checkIsUrlBlocked = (
    urlVisited: string, 
    blacklist: string[] = [], 
    whitelist: string[] = [], 
    isStrictMode: boolean = false
  ): boolean => {
    if (!urlVisited) return false;
  
    // 1. Limpiamos la URL visitada para una comparación precisa
    const cleanUrl = urlVisited
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '') // Quita protocolos y www
      .trim();
  
    // --- MODO ESTRICTO (Whitelisting) ---
    // Si está activo, TODO está bloqueado excepto lo que esté en la lista blanca
    if (isStrictMode) {
      if (!whitelist || whitelist.length === 0) return true; // Bloqueo total si no hay nada permitido
  
      const isAllowed = whitelist.some(allowedItem => {
        const cleanAllowed = allowedItem.toLowerCase().trim();
        // Si la URL visitada contiene o es igual a un sitio permitido
        return cleanUrl.includes(cleanAllowed);
      });
  
      return !isAllowed; // Retorna TRUE (Bloqueado) si NO está en la lista blanca
    }
  
    // --- MODO NORMAL (Blacklisting) ---
    // Bloquea solo si la URL contiene alguna palabra o dominio de la lista negra
    if (!blacklist || blacklist.length === 0) return false;
  
    return blacklist.some(blockedItem => {
      const cleanBlocked = blockedItem.toLowerCase().trim();
      return cleanUrl.includes(cleanBlocked);
    });
  };