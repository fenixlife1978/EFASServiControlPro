'use client';
import React, { useState, useEffect } from 'react';
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
import { auth, db } from '@/firebase/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export function AdminUserNav() {
  const router = useRouter();
  const [userData, setUserData] = useState({
    nombre: 'Usuario',
    role: 'CARGANDO...',
    email: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchamos cambios de auth. Cada vez que el usuario cambie, este efecto se dispara.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // IMPORTANTE: Si el email cambió respecto al estado anterior, forzamos carga
        const email = user.email || '';
        
        try {
          if (email === 'vallecondo@gmail.com') {
            setUserData({ nombre: "Super Admin", role: "SUPER ADMIN", email });
          } else {
            // Buscamos SIEMPRE en la colección usuarios con el email actual
            const q = query(collection(db, "usuarios"), where("email", "==", email), limit(1));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
              const d = snap.docs[0].data();
              setUserData({
                nombre: d.nombre || "Director",
                role: d.role === 'director' ? "DIRECTOR" : (d.role?.toUpperCase() || "USUARIO"),
                email: email
              });
            } else {
              setUserData({ nombre: "Usuario", role: "NO ENCONTRADO", email });
            }
          }
        } catch (error) {
          console.error("Error Nav:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []); // El array vacío es correcto porque onAuthStateChanged es un listener activo

  const handleLogout = async () => {
    setLoading(true);
    await auth.signOut(); document.cookie = "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;"; window.localStorage.clear(); window.location.replace("/login");
    // Limpieza manual extra para evitar el error del "segundo intento"
    window.localStorage.clear();
    router.refresh();
    router.push('/login');
  };

  if (loading) return <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-orange-500/20 shadow-sm">
          <Avatar className="h-full w-full">
            <AvatarFallback className="bg-slate-900 text-orange-500 font-black text-xs">
              {userData.nombre.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2 p-1">
            <div className="flex flex-col">
              <p key={userData.role} className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 animate-in fade-in duration-500">
                {userData.role}
              </p>
              <p className="text-sm font-bold text-slate-900">{userData.nombre}</p>
            </div>
            <p className="text-xs text-muted-foreground truncate italic">{userData.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { auth.signOut().then(() => { document.cookie = "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;"; localStorage.clear(); sessionStorage.clear(); window.location.replace("/login"); }); }} className="text-red-600 font-bold uppercase text-[10px] cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
