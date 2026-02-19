'use client';
import { useEffect, useState } from 'react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import InstitutionView from '@/components/dashboard/InstitutionView';
import SuperAdminView from '@/components/dashboard/SuperAdminView';
import DirectorView from '@/components/dashboard/DirectorView';

export default function DashboardPage() {
  const { institutionId, setInstitutionId } = useInstitution();
  const [role, setRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    setRole(savedRole);
    setIsMounted(true);

    // Si eres Director y por algún motivo el contexto tiene un ID activo,
    // lo limpiamos al entrar para asegurar que veas tu Panel de Sede primero.
    if (savedRole === 'director' && institutionId) {
       // setInstitutionId(null); // Opcional: Descomenta si quieres resetear siempre
    }
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // LÓGICA DE PRIORIDAD EFAS ServiControlPro:
  // Si soy SA y elegí un instituto -> InstitutionView
  if (role === 'super-admin' && institutionId) return <main><InstitutionView /></main>;
  
  // Si soy SA y no elegí nada -> Panel Global
  if (role === 'super-admin') return <main><SuperAdminView /></main>;

  // Si soy Director -> SIEMPRE al DirectorView (Panel de Sede)
  // Nota: El Director entrará a InstitutionView solo cuando él lo decida
  if (role === 'director') return <main><DirectorView /></main>;

  // Por defecto (Profesores, etc)
  return <main><InstitutionView /></main>;
}
