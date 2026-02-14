'use client';

import { Button } from '@/components/ui/button';
import { CreateInstitutionForm } from '@/components/super-admin/create-institution-form';
import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { InstitutionList } from '@/components/super-admin/institution-list';
import { Loader2, LogOut } from 'lucide-react';
import { Logo } from '@/components/common/logo';

export default function SuperAdminDashboard() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login?redirect=/super-admin');
      } else if (user.uid !== 'QeGMDNE4GaSJOU8XEnY3lFJ9by13') {
        // Not a super admin, redirect to regular dashboard
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);
  
  const handleLogout = async () => {
    if (auth) {
        await auth.signOut();
        router.push('/login');
    }
  };


  if (loading || !user || user.uid !== 'QeGMDNE4GaSJOU8XEnY3lFJ9by13') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#050510]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] text-white p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
            <Logo />
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                Super Admin: <span className="text-slate-300">{user.email}</span>
            </p>
        </div>
        <Button onClick={handleLogout} className="bg-red-900/30 text-red-500 border border-red-900/50 px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all h-auto">
          <LogOut className="w-4 h-4" />
          SALIR
        </Button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-8">
        <CreateInstitutionForm />
      </div>
    
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl text-slate-900">
        <InstitutionList />
      </div>

    </div>
  );
}
