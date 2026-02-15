'use client';

import {
  Users,
  ShieldCheck,
  Building,
  Home,
  ShieldX,
  School,
  Settings,
  Download,
} from 'lucide-react';
import Image from 'next/image';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { usePathname, redirect, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { useEffect, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { InstitutionProvider } from './institution-context';
import { DashboardHeader } from '@/components/admin/dashboard-header';
import { Logo } from '@/components/common/logo';
import { cn } from '@/lib/utils';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const AdminSidebar = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useUser();
    const { installApp, isInstallable, isStandalone } = usePWAInstall();
    const efasLogo = PlaceHolderImages.find(img => img.id === 'efas-logo');

    const createLink = (path: string) => {
        const params = new URLSearchParams(searchParams.toString());
        return `${path}?${params.toString()}`;
    }

    const menuItems = [
      { 
        label: "Salones/Aulas", 
        href: "/dashboard/classrooms", 
        icon: <School className="w-5 h-5" /> 
      },
      { 
        label: "Filtros URL", 
        href: `/dashboard/seguridad`, 
        icon: <ShieldCheck className="w-5 h-5" /> 
      },
      { 
        label: "Configuración", 
        href: "/dashboard/settings", 
        icon: <Settings className="w-5 h-5" /> 
      },
    ];

    return (
        <Sidebar>
            <SidebarHeader className="border-b border-sidebar-border/50">
              <div className="flex flex-col items-center gap-2 px-6 py-10">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-blue-950 rounded-full blur opacity-25 group-hover:opacity-40 transition"></div>
                  <div className="relative w-[60px] h-[60px] rounded-full border-2 border-white/10 overflow-hidden">
                    {efasLogo ? (
                      <Image src={efasLogo.imageUrl} alt="EFAS Logo" width={60} height={60} data-ai-hint={efasLogo.imageHint} className="object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-700"></div>
                    )}
                  </div>
                </div>
                <div className="text-center mt-2">
                  <h1 className="text-xl font-black italic tracking-tighter leading-none text-white">
                    EFAS <span className="text-orange-500">ServiControlPro</span>
                  </h1>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.1em] mt-1">
                    Control Parental Multi-Usuarios
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className='p-4'>
                <SidebarMenu>
                    {menuItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton 
                                asChild 
                                isActive={pathname.startsWith(item.href)} 
                                className="justify-start gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group data-[active=true]:bg-orange-500 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-orange-500/20 text-slate-400 hover:bg-white/5 hover:text-white"
                            >
                                <Link href={createLink(item.href)}>
                                    <span className={cn(
                                      "transition-colors text-slate-500 group-hover:text-orange-400",
                                      pathname.startsWith(item.href) && "text-white"
                                    )}>
                                      {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className='border-t border-sidebar-border/50 p-4'>
                 {user?.email === 'vallecondo@gmail.com' && (
                     <div className="bg-sidebar-accent rounded-2xl p-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Super Admin</p>
                        <p className="text-[11px] font-bold text-slate-300 mt-1 truncate">{user.email}</p>
                        <button
                          onClick={installApp}
                          disabled={!isInstallable}
                          className={`w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                            isInstallable
                              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          {isStandalone ? 'App Instalada' : isInstallable ? 'Instalar App' : 'No Soportado'}
                        </button>
                    </div>
                 )}
            </SidebarFooter>
        </Sidebar>
    );
}

function AdminLayoutLoading() {
    return (
      <div className="flex h-screen w-full">
        <div className="hidden md:flex h-full w-64 flex-col border-r bg-sidebar">
            <div className='p-6'><Skeleton className="h-8 w-32 bg-sidebar-accent" /></div>
            <div className="p-4 space-y-2">
                <Skeleton className="h-10 w-full bg-sidebar-accent" />
                <Skeleton className="h-10 w-full bg-sidebar-accent" />
                <Skeleton className="h-10 w-full bg-sidebar-accent" />
            </div>
        </div>
        <div className="flex-1 flex flex-col bg-background">
            <main className="flex-1 p-8">
                <Skeleton className="h-full w-full" />
            </main>
        </div>
      </div>
    )
}

function AdminLayoutComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  // CORRECCIÓN: Eliminamos 'error' de la desestructuración
  const { user, loading } = useUser(); 
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Si terminó de cargar y no hay usuario, redirigimos
    if (!loading && !user) {
      const redirectUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [user, loading, pathname, searchParams]);

  if (loading) {
    return <AdminLayoutLoading />;
  }

  if (!user) {
    return null;
  }

  return (
    <InstitutionProvider>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b">
            <DashboardHeader />
          </header>
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </InstitutionProvider>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminLayoutLoading />}>
      <AdminLayoutComponent>
        {children}
      </AdminLayoutComponent>
    </Suspense>
  );
}
