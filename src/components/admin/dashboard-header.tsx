
'use client';

import React from 'react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { AdminUserNav } from "../common/admin-user-nav";
import { SidebarTrigger } from "../ui/sidebar";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

export function DashboardHeader() {
  const { institutionId, institutionData: institution, institution: altInstitution } = useInstitution() as any; 
  const currentInst = institution || altInstitution;
  const { user } = useUser();
  const router = useRouter();

  const isSuperAdmin = user?.email === 'vallecondo@gmail.com';

  return (
    <header className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 border-b bg-background">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <SidebarTrigger/>
        </div>
        
        {currentInst?.logoUrl ? (
          <img src={currentInst?.logoUrl} alt="Logo" className="h-8 w-auto object-contain hidden md:block" />
        ) : (
          <div className="bg-orange-600 p-2 rounded text-white font-bold text-xs hidden md:flex items-center justify-center h-8 w-8">
            {institutionId?.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        <div>
          <h1 className="text-foreground font-bold text-lg hidden md:block">
            {currentInst?.nombre || 'EDUControlPro'}
          </h1>
          <p className="md:hidden text-sm font-bold text-foreground">
             {currentInst?.nombre || 'EDUControlPro'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isSuperAdmin && (
          <Button 
            variant="ghost" 
            onClick={() => router.push('/super-admin')}
            className="text-orange-500 hover:text-orange-400 hover:bg-orange-500/10 flex items-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-tighter">Panel Maestro</span>
          </Button>
        )}
        
        <AdminUserNav />
      </div>
    </header>
  );
}
