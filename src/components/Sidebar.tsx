'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/firebase/config';
import { NAV_ITEMS } from '@/config/navigation';

export default function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const userEmail = auth.currentUser?.email;
  const isSuperAdmin = userEmail === 'vallecondo@gmail.com';

  const filteredItems = NAV_ITEMS.filter(item => {
    if (isSuperAdmin) return true;
    return item.roles.includes(userRole);
  });

  return (
    <aside className="w-72 h-[calc(100vh-2rem)] m-4 p-6 bg-slate-900 rounded-[3rem] flex flex-col shadow-2xl border border-slate-800">
      <div className="mb-10 px-4">
        <h2 className="text-2xl font-black italic text-white tracking-tighter leading-none">
          EFAS <span className="text-orange-500 block text-sm not-italic tracking-[0.2em]">SERVICONTROLPRO</span>
        </h2>
      </div>

      <nav className="flex-1 space-y-2">
        {filteredItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black italic uppercase text-xs tracking-widest transition-all ${
                isActive 
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 translate-x-2' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="text-xl not-italic">{item.icon}</span>
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4 bg-slate-800/50 rounded-[2rem] border border-slate-700">
        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Usuario Activo</p>
        <p className="text-xs font-bold text-slate-300 truncate">{userEmail}</p>
        <button 
          onClick={() => auth.signOut()}
          className="mt-4 w-full py-2 bg-red-500/10 hover:bg-red-500 text-red-500 rounded-xl text-[10px] font-black uppercase transition-all"
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
