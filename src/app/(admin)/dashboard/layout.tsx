'use client';
import { auth } from '@/firebase/config';
import React, { useEffect, useState, Suspense } from 'react';
import { 
  ShieldCheck, 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  Download,
  School
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { InstitutionProvider } from './institution-context';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const AdminNavbar = () => {
  const pathname = usePathname();
  const { installApp, isInstallable, isStandalone } = usePWAInstall();

  const handleLogout = () => {
    auth.signOut().then(() => {
      document.cookie = "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/login");
    });
  };

  return (
    <nav className="border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-md sticky top-0 z-[50]">
      <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="bg-orange-600 p-2 rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.3)] group-hover:scale-105 transition-transform">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-white font-black italic uppercase tracking-tighter text-lg leading-none">
              EDU <span className="text-orange-500">ControlPro</span>
            </h1>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.3em]">Institutional Security</p>
          </div>
        </Link>

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

        <div className="flex items-center gap-6">
          {isInstallable && !isStandalone && (
            <button 
              onClick={installApp}
              className="hidden md:flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white border border-orange-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
            >
              <Download className="w-3 h-3" /> Instalar App
            </button>
          )}

          <div className="flex items-center gap-4 border-l border-white/10 pl-6">
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !user) {
      const currentParams = searchParams.toString();
      const redirectUrl = `${pathname}${currentParams ? `?${currentParams}` : ''}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [user, loading, pathname, searchParams, router, mounted]);

  if (!mounted || loading) return <AdminLayoutLoading />;
  if (!user) return null;

  return (
    <InstitutionProvider>
      <div className="min-h-screen bg-[#0a0c10] flex flex-col font-sans text-slate-200">
        <AdminNavbar />
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
        <footer className="py-8 border-t border-white/5 text-center bg-[#0a0c10]">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.5em]">
            EDUControlPro Sistema de Control Parental Educativo © 2026 • Security Infrastructure
          </p>
        </footer>
      </div>
    </InstitutionProvider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminLayoutLoading />}>
      <AdminLayoutComponent>{children}</AdminLayoutComponent>
    </Suspense>
  );
}
