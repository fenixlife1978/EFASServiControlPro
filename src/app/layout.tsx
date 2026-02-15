'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { useState, useEffect } from "react";
import { MasterLockScreen } from "@/components/security/MasterLockScreen";
import { reportSecurityEvent } from "@/lib/security-service";
import { subscribeToMasterKey } from "@/lib/config-service";
import { initializeSecurityBridge } from "@/lib/SecurityBridge";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLocked, setIsLocked] = useState(false);
  const [masterKey, setMasterKey] = useState("");

  useEffect(() => {
    // 1. Escuchar la clave maestra desde Firestore en tiempo real
    const unsubscribe = subscribeToMasterKey((key) => {
      setMasterKey(key);
    });

    // 2. Inicializar el puente de seguridad nativo
    initializeSecurityBridge(setIsLocked);

    return () => unsubscribe();
  }, []);

  const handleUnlock = async (inputKey: string) => {
    if (inputKey === masterKey) {
      setIsLocked(false);
    } else {
      // Si la clave falla, reportamos el incidente a tu correo
      await reportSecurityEvent('general', 'dispositivo-movil', 'LOCK_BYPASS');
      alert("Clave Maestra Incorrecta. Intento reportado a vallecondo@gmail.com");
    }
  };

  return (
    <html lang="es">
      <body className={inter.className}>
        {isLocked && <MasterLockScreen onUnlock={handleUnlock} />}
        
        <div className={isLocked ? "blur-xl pointer-events-none overflow-hidden" : ""}>
          {children}
        </div>
      </body>
    </html>
  );
}
