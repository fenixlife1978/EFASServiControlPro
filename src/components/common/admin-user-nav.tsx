'use client';
import React, { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User as UserIcon } from 'lucide-react';
import { auth } from '@/firebase/config';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth'; // Usamos tu hook centralizado

export function AdminUserNav() {
  const router = useRouter();
  const { user, userData } = useAuth() as { user: any; userData: any };
  const [isExiting, setIsExiting] = useState(false);

  // Lógica de visualización basada en userData centralizado
  const displayData = {
    nombre: user?.email === 'vallecondo@gmail.com' ? "Super Admin" : (userData?.nombre || "Usuario"),
    role: user?.email === 'vallecondo@gmail.com' ? "SUPER ADMIN" : (userData?.role?.toUpperCase() || "CARGANDO..."),
    email: user?.email || ""
  };

  const handleLogout = async () => {
    setIsExiting(true);
    try {
      // Cerramos sesión en Firebase y eliminamos la cookie de sesión
      await auth.signOut();
      document.cookie = "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      
      // ✅ IMPORTANTE: Mantenemos app_config y setup_completed intactos en localStorage
      
      router.refresh();
      router.push('/login');
    } catch (error) {
      console.error("Error Logout:", error);
      setIsExiting(false);
    }
  };

  // Estado de carga inicial
  if (!user && !userData) return <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse border border-white/5" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-orange-500/20 shadow-sm transition-transform hover:scale-105 active:scale-95 overflow-hidden">
          <Avatar className="h-full w-full">
            <AvatarFallback className="bg-[#0a0c10] text-orange-500 font-black text-[10px] italic">
              {displayData.nombre.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-64 bg-[#0f1117] border border-white/5 shadow-2xl rounded-2xl" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2 p-2">
            <div className="flex flex-col">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500 italic">
                {displayData.role}
              </p>
              <p className="text-sm font-bold text-white tracking-tight leading-tight">
                {displayData.nombre}
              </p>
            </div>
            <p className="text-[10px] text-slate-500 truncate font-medium">
              {displayData.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-white/5" />
        
        <DropdownMenuItem 
          onClick={handleLogout} 
          disabled={isExiting}
          className="text-red-500 focus:text-red-400 focus:bg-red-500/5 font-black uppercase text-[10px] cursor-pointer p-3 rounded-xl m-1 transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" /> 
          {isExiting ? "CERRANDO..." : "FINALIZAR SESIÓN"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
