'use client';

import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Hook para detectar si el dispositivo es móvil basado en el breakpoint corporativo.
 * Optimizado para evitar desajustes entre el listener y el valor retornado.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Definimos el query de forma precisa
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Sincronizamos el estado inicial
    setIsMobile(mql.matches)

    // El listener ahora usa el estado del match directamente, lo cual es más eficiente
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    mql.addEventListener("change", onChange)
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
