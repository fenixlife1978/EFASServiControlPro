'use client';

import React, { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { useRouter } from 'next/navigation';

export default function SupervisorPanelClient() {
  const { userRole, loadingPermissions } = useInstitution();
  const router = useRouter();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deviceStats, setDeviceStats] = useState<Record<string, { total: number, online: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loadingPermissions && userRole !== 'supervisor' && userRole !== 'director-supervisor' && userRole !== 'super-admin') {
      router.push('/dashboard/unauthorized');
    }
  }, [userRole, loadingPermissions, router]);

  useEffect(() => {
    const q = query(collection(db, "institutions"), orderBy("InstitutoId", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const institutionsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setInstitutions(institutionsData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const devicesRef = ref(rtdb, 'dispositivos');
    const unsubscribe = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const stats: Record<string, { total: number, online: number }> = {};
        const now = Date.now();
        Object.values(data).forEach((dev: any) => {
          const instId = dev.InstitutoId;
          if (!instId) return;
          if (!stats[instId]) stats[instId] = { total: 0, online: 0 };
          stats[instId].total++;
          const lastSeen = dev.lastSeen || dev.ultimoAcceso || 0;
          if (now - lastSeen < 45000) stats[instId].online++;
        });
        setDeviceStats(stats);
      }
    });
    return () => off(devicesRef);
  }, []);

  const filtered = institutions.filter(inst => 
    inst.InstitutoId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
        <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10">
      <header>
        <h1 className="text-5xl font-black italic uppercase text-white tracking-tighter">
          Director <span className="text-orange-500">Supervisor</span>
        </h1>
      </header>
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder="BUSCAR SEDE..." 
          className="w-full bg-[#0f1117] border border-slate-800 rounded-2xl py-5 pl-12 text-white text-xs font-black uppercase"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? <p className="text-white">Cargando...</p> : filtered.map((inst) => {
          const stats = deviceStats[inst.InstitutoId] || { total: 0, online: 0 };
          return (
            <Link 
              key={inst.id} 
              href={`/dashboard/supervisor/monitor?institutoId=${inst.InstitutoId}`}
              className="group bg-[#0f1117] border border-slate-800 p-8 rounded-[3rem] block"
            >
              <h3 className="text-2xl font-black italic uppercase text-white mb-2">{inst.InstitutoId}</h3>
              <div className="flex justify-between text-slate-500 pt-4 border-t border-white/5">
                <span>Docs: {stats.total}</span>
                <span className="text-green-500">Online: {stats.online}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
