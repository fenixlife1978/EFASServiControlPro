'use client';

import React, { useState, useEffect } from 'react';
import { MasterLockScreen } from "@/components/security/MasterLockScreen";
import { reportSecurityEvent } from "@/lib/security-service";
import LockListener from "@/components/security/LockListener";

/**
 * SecurityWrapper handles global client-side security states and styles.
 * It manages the MasterLockScreen and global CSS rules via styled-jsx.
 */
export function SecurityWrapper({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);

  // Lógica para detectar intento de desinstalación (simulado para la interfaz)
  useEffect(() => {
    // Aquí iría el listener nativo de Capacitor/Android
    // Ejemplo:
    // DevicePolicies.onUninstallAttempt(() => {
    //    reportSecurityEvent('instId', 'deviceId', 'UNINSTALL_ATTEMPT');
    //    setIsLocked(true);
    // });
  }, []);

  const handleUnlock = (key: string) => {
    // VALIDACIÓN DE CLAVE MAESTRA
    if (key === '1234') { // Ejemplo: clave 1234
      setIsLocked(false);
    } else {
      alert('Clave incorrecta');
      
      // Intentamos recuperar IDs para el reporte de seguridad
      const instId = typeof window !== 'undefined' ? localStorage.getItem('InstitutoId') || 'SYSTEM' : 'SYSTEM';
      const devId = typeof window !== 'undefined' ? localStorage.getItem('deviceId') || 'TERMINAL' : 'TERMINAL';
      
      reportSecurityEvent(instId, devId, 'LOCK_BYPASS'); // Alerta de intento fallido
    }
  };

  return (
    <>
      {/* Pantalla de bloqueo maestra si el sistema está restringido */}
      {isLocked && <MasterLockScreen onUnlock={handleUnlock} />}
      
      {/* Capa de Red (LockListener) montada a nivel global para bloqueos remotos */}
      <LockListener />
      
      <main className="min-h-screen relative">
        {children}
      </main>

      {/* Estilos globales para comportamiento del sistema (requiere Client Component) */}
      <style jsx global>{`
        .scanner-active {
          overflow: hidden !important;
        }
        ::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}
