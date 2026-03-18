'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { DatabaseSelector } from '@/components/DatabaseSelector';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    // 1. Verificamos la persistencia del protocolo
    const config = localStorage.getItem('app_config');
    const setupCompleted = localStorage.getItem('setup_completed');
    
    const configExists = !!(config || setupCompleted);
    setHasConfig(configExists);
    setCheckingConfig(false);

    // 2. Redirección inteligente basada en identidad y configuración
    if (configExists && !authLoading) {
      if (user) {
        // Usuario autenticado -> Al panel de control
        router.push('/dashboard');
      } else {
        // No autenticado -> Al terminal de acceso
        router.push('/login');
      }
    }
  }, [user, authLoading, router]);

  // ESTADO 1: Verificando integridad del sistema
  if (checkingConfig || (hasConfig && authLoading)) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
          <div className="absolute inset-0 bg-orange-500/20 blur-xl animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-[10px] font-black tracking-[0.4em] text-white uppercase italic">Iniciando Shield</h2>
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Verificando Protocolos de Sede</p>
        </div>
      </div>
    );
  }

  // ESTADO 2: El dispositivo no tiene configuración (Primer arranque o Reset)
  if (!hasConfig) {
    return <DatabaseSelector />;
  }

  // Fallback de seguridad mientras se procesa la redirección
  return (
    <div className="min-h-screen bg-[#050505]" />
  );
}