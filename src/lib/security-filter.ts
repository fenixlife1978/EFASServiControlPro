/**
 * EDUControlPro - Security Filter Logic
 * Compara una URL visitada contra las reglas de la institución.
 * Soporta Modo Normal (Blacklist) y Modo Estricto (Whitelist).
 */

interface SecurityFilterOptions {
  urlVisited: string;
  blacklist?: string[];
  whitelist?: string[];
  isStrictMode?: boolean;
}

export const checkIsUrlBlocked = ({
  urlVisited,
  blacklist = [],
  whitelist = [],
  isStrictMode = false
}: SecurityFilterOptions): boolean => {
  if (!urlVisited) return false;

  // Limpiamos la URL visitada
  const cleanUrl = urlVisited
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .trim();

  // MODO ESTRICTO (Whitelist)
  if (isStrictMode) {
    if (!whitelist || whitelist.length === 0) return true;

    const isAllowed = whitelist.some(allowedItem => {
      const cleanAllowed = allowedItem.toLowerCase().trim();
      return cleanUrl.includes(cleanAllowed);
    });

    return !isAllowed;
  }

  // MODO NORMAL (Blacklist)
  if (!blacklist || blacklist.length === 0) return false;

  return blacklist.some(blockedItem => {
    const cleanBlocked = blockedItem.toLowerCase().trim();
    return cleanUrl.includes(cleanBlocked);
  });
};

// Versión con parámetros individuales (para compatibilidad)
export const checkIsUrlBlockedLegacy = (
  urlVisited: string,
  blacklist: string[] = [],
  whitelist: string[] = [],
  isStrictMode: boolean = false
): boolean => {
  return checkIsUrlBlocked({ urlVisited, blacklist, whitelist, isStrictMode });
};