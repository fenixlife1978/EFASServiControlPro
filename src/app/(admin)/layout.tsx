'use client';

import React, { useEffect, Suspense } from 'react';
import { 
  ShieldCheck, 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  Download,
  School
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, redirect, useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { InstitutionProvider } from './institution-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { usePWAInstall } from '@/hooks/usePWAInstall';

// --- COMPONENTE DE NAVEGACIÓN SUPERIOR ---
const AdminNavbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { installApp, isInstallable, isStandalone } = usePWAInstall();
  const efasLogo = PlaceHolderImages.find(img => img.id === 'efas-logo');

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <nav className="border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-md sticky top-0 z-[50]">
      <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Logo y Branding */}
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="bg-orange-600 p-2 rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.3)] group-hover:scale-105 transition-transform">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-white font-black italic uppercase tracking-tighter text-lg leading-none">
              EFAS <span className="text-orange-500">ServiControlPro</span>
            </h1>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.3em]">Institutional Security</p>
          </div>
        </Link>

        {/* Enlaces de Navegación Centrales */}
        <div className="hidden lg:flex items-center gap-8">
          <Link 
            href="/dashboard" 
            className={`text-[11px] font-black uppercase italic flex items-center gap-2 transition-colors ${pathname === '/dashboard' ? 'text-orange-500' : 'text-slate-400 hover:text-white'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link 
            href="/dashboard/classrooms" 
            className={`text-[11px] font-black uppercase italic flex items-center gap-2 transition-colors ${pathname.includes('classrooms') ? 'text-orange-500' : 'text-slate-400 hover:text-white'}`}
          >
            <School className="w-4 h-4" /> Aulas
          </Link>
          <Link 
            href="/institutions" 
            className={`text-[11px] font-black uppercase italic flex items-center gap-2 transition-colors ${pathname.includes('institutions') ? 'text-orange-500' : 'text-slate-400 hover:text-white'}`}
          >
            <Settings className="w-4 h-4" /> Instituciones
          </Link>
        </div>

        {/* Perfil y Acciones */}
        <div className="flex items-center gap-6">
          {/* PWA Install Button (Solo si es instalable) */}
          {isInstallable && !isStandalone && (
            <button 
              onClick={installApp}
              className="hidden md:flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
            >
              <Download className="w-3 h-3" /> Instalar App
            </button>
          )}

          <div className="flex items-center gap-4 border-l border-white/10 pl-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-white uppercase italic">{user?.email}</p>
              <p className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Super Admin</p>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-white/5 hover:bg-red-500/10 p-3 rounded-xl border border-white/5 hover:border-red-500/20 transition-all group"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-500" />
            </button>
          </div>
        </div>

      </div>
    </nav>
  );
};

function AdminLayoutLoading() {
  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col">
      <div className="h-20 border-b border-white/5 flex items-center px-6">
        <Skeleton className="h-8 w-48 bg-white/5" />
      </div>
      <div className="flex-1 p-8">
        <Skeleton className="h-full w-full bg-white/5 rounded-3xl" />
      </div>
    </div>
  );
}

function AdminLayoutComponent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser(); 
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [user, loading, pathname, searchParams]);

  if (loading) return <AdminLayoutLoading />;
  if (!user) return null;

  return (
    <InstitutionProvider>
      <div className="min-h-screen bg-[#0a0c10] flex flex-col font-sans">
        <AdminNavbar />
        
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 md:p-8 overflow-y-auto">
          {children}
        </main>

        <footer className="py-8 border-t border-white/5 text-center bg-[#0a0c10]">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.5em]">
            EFAS ServiControlPro © 2026 • Security Infrastructure
          </p>
        </footer>
      </div>
    </InstitutionProvider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminLayoutLoading />}>
      <AdminLayoutComponent>
        {children}
      </AdminLayoutComponent>
    </Suspense>
  );
}
