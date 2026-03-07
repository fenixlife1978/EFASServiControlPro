'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { DatabaseSelector } from '@/components/DatabaseSelector';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    // 🔥 CORREGIDO: Leer de app_config (no de edu_db_mode)
    const config = localStorage.getItem('app_config');
    const setupCompleted = localStorage.getItem('setup_completed');
    
    // Si existe configuración o ya completó el setup, consideramos que ya eligió modo
    const configExists = !!(config || setupCompleted);
    setHasConfig(configExists);
    setCheckingConfig(false);

    // Solo redirigir si ya hay configuración
    if (configExists && !loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Si estamos verificando la configuración inicial, mostramos carga
  if (checkingConfig) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  // 🔥 CORREGIDO: Si NO HAY CONFIGURACIÓN, mostramos el selector
  if (!hasConfig) {
    return <DatabaseSelector />;
  }

  // Si ya hay configuración pero está cargando el usuario, mostramos el spinner
  return (
    <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
    </div>
  );
}