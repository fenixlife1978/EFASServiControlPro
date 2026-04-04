'use client';

import React from 'react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { AdminUserNav } from "../common/admin-user-nav";
import { SidebarTrigger } from "../ui/sidebar";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ShieldCheck } from "lucide-react";

export function DashboardHeader() {
  const { institutionId, institutionData: institution, institution: altInstitution } = useInstitution() as any; 
  const currentInst = institution || altInstitution;
  const { user } = useUser();
  const router = useRouter();

  // Verificación de SuperAdmin
  const isSuperAdmin = user?.email === 'vallecondo@gmail.com';

  return (
    <header className="flex h-20 items-center justify-between px-4 sm:px-8 border-b border-slate-800 bg-[#0f1117] sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-6">
        {/* Trigger para móviles con estilo consistente */}
        <div className="md:hidden">
          <SidebarTrigger className="text-slate-400 hover:text-white" />
        </div>
        
        {/* Logo de la Institución o Placeholder */}
        <div className="flex items-center gap-4">
          {currentInst?.logoUrl ? (
            <div className="bg-white p-1 rounded-xl hidden md:block shadow-lg">
               <img src={currentInst?.logoUrl} alt="Logo Institución" className="h-10 w-auto object-contain" />
            </div>
          ) : (
            <div className="bg-orange-600 p-2 rounded-2xl text-white font-black text-[10px] hidden md:flex items-center justify-center h-10 w-10 shadow-lg shadow-orange-600/20">
              {institutionId?.substring(0, 2).toUpperCase() || 'ED'}
            </div>
          )}
          
          <div className="flex flex-col">
            <h1 className="text-white font-black text-xl uppercase italic tracking-tighter leading-none hidden md:block">
              {currentInst?.nombre || 'EDUControlPro'}
            </h1>
            <p className="md:hidden text-sm font-black text-white uppercase italic tracking-tighter">
               {currentInst?.nombre || 'EDUControlPro'}
            </p>
            <span className="text-[8px] font-black text-orange-500 uppercase tracking-[0.2em] leading-tight hidden md:block">
              Gestión y Monitoreo Digital
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Botón de Panel Maestro (SuperAdmin) */}
        {isSuperAdmin && (
          <Button 
            variant="ghost" 
            onClick={() => router.push('/super-admin')}
            className="text-orange-500 hover:text-white hover:bg-orange-500 border border-orange-500/20 flex items-center gap-2 px-4 rounded-xl transition-all duration-300"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase italic tracking-widest">Panel Maestro</span>
          </Button>
        )}
        
        {/* Navegación de Usuario (Admin) */}
        <div className="pl-4 border-l border-slate-800">
          <AdminUserNav />
        </div>
      </div>
    </header>
  );
}
