'use client';

import React, { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
// Importación directa del proveedor unificado para evitar conflictos de contexto
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { MasterLockScreen } from "@/components/security/MasterLockScreen";
import { reportSecurityEvent } from "@/lib/security-service";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // Aquí iría el listener nativo de Capacitor/Android
    // Ejemplo:
    // DevicePolicies.onUninstallAttempt(() => {
    //    reportSecurityEvent('condoId', 'deviceId', 'UNINSTALL_ATTEMPT');
    //    setIsLocked(true);
    // });
  }, []);

  const handleUnlock = (key: string) => {
    // VALIDACIÓN DE CLAVE MAESTRA CONTRA FIREBASE
    if (key === '1234') { // Ejemplo: clave 1234
      setIsLocked(false);
    } else {
      alert('Clave incorrecta');
      reportSecurityEvent('condoId', 'deviceId', 'LOCK_BYPASS'); // Alerta de intento fallido
    }
  };

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Fuentes optimizadas para el estilo Black Italic de la marca */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        {isLocked && <MasterLockScreen onUnlock={handleUnlock} />}
        {/* FirebaseClientProvider: Centro de Control de Identidad. 
            Maneja la inicialización de protocolos de seguridad y servicios de datos.
        */}
        <FirebaseClientProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </FirebaseClientProvider>
        
        {/* Sistema de notificaciones de protocolos */}
        <Toaster />
      </body>
    </html>
  );
}
