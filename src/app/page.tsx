'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function HomePage() {
  const { user, userData, loading, isSuperAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Si ya está logueado, lo mandamos al dashboard
        // La lógica de qué ver (Admin o Profesor) ya la maneja el componente dashboard/page.tsx
        router.push('/dashboard');
      } else {
        // Si no hay usuario, lo mandamos al login
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
    </div>
  );
}
