'use client';

import React, { useState, useEffect } from 'react';
import { MasterLockScreen } from "@/components/security/MasterLockScreen";
import { reportSecurityEvent } from "@/lib/security-service";
import LockListener from "@/components/security/LockListener";

export function SecurityWrapper({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);

  const handleUnlock = (key: string) => {
    if (key === '1234') {
      setIsLocked(false);
    } else {
      const instId = localStorage.getItem('InstitutoId') || 'SYSTEM';
      const devId = localStorage.getItem('deviceId') || 'TERMINAL';
      reportSecurityEvent(instId, devId, 'LOCK_BYPASS');
      alert('Clave incorrecta');
    }
  };

  return (
    <>
      {isLocked && <MasterLockScreen onUnlock={handleUnlock} />}
      <LockListener />
      <main className="min-h-screen relative">
        {children}
      </main>
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
