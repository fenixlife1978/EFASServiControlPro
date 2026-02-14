'use client';
import { useInstitution } from "@/app/(admin)/institution-context";
import { AdminUserNav } from "../common/admin-user-nav";
import { SidebarTrigger } from "../ui/sidebar";

export function DashboardHeader() {
  const { institutionData, institutionId } = useInstitution();

  return (
    <header className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 border-b">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <SidebarTrigger/>
        </div>
        
        {institutionData?.logoUrl ? (
          <img src={institutionData.logoUrl} alt="Logo" className="h-8 w-auto object-contain hidden md:block" />
        ) : (
          <div className="bg-orange-600 p-2 rounded text-white font-bold text-xs hidden md:flex items-center justify-center h-8 w-8">
            {institutionId?.substring(0, 2)}
          </div>
        )}
        
        <div>
          <h1 className="text-foreground font-bold text-lg hidden md:block">
            {institutionData?.nombre || 'Cargando...'}
          </h1>
          <p className="md:hidden text-sm font-bold text-foreground">
             {institutionData?.nombre || 'Cargando...'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <AdminUserNav />
      </div>
    </header>
  );
}
