'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Te envía directamente al login nada más cargar
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );
}
