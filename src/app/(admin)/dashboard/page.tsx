'use client';
import { useEffect, useState } from 'react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import InstitutionView from '@/components/dashboard/InstitutionView';
import SuperAdminView from '@/components/dashboard/SuperAdminView';

export default function DashboardPage() {
  const { institutionId } = useInstitution();
  const [role, setRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    setRole(savedRole);
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // LÓGICA DE RENDERIZADO EFAS:
  // 1. Si hay un institutionId activo (seleccionado por SA o asignado a Director), manda la vista de Institución.
  // 2. Si no hay ID y el rol es super-admin, manda el panel global.
  // 3. Por defecto, InstitutionView (para directores/profesores).
  
  return (
    <main>
      {institutionId ? (
        <InstitutionView />
      ) : role === 'super-admin' ? (
        <SuperAdminView />
      ) : (
        <InstitutionView />
      )}
    </main>
  );
}
