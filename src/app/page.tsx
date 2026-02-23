'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { DatabaseSelector } from '@/components/DatabaseSelector';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // Estado para saber si ya se eligió un modo (Local/Nube)
  const [dbMode, setDbMode] = useState<string | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);

  useEffect(() => {
    // 1. Verificamos la configuración en la memoria del PC
    const savedMode = localStorage.getItem('edu_db_mode');
    setDbMode(savedMode);
    setCheckingConfig(false);

    // 2. Solo si ya hay una configuración, procedemos con el login/dashboard
    if (savedMode && !loading) {
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

  // SI NO HAY CONFIGURACIÓN: Mostramos la pantalla de "Selección de Base de Datos"
  if (!dbMode) {
    return <DatabaseSelector />;
  }

  // Si ya hay configuración pero está cargando el usuario, mostramos el spinner
  return (
    <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
    </div>
  );
}