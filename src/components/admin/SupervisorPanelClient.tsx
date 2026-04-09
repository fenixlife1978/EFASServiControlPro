'use client';

import React, { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { Building2, ArrowRight, ShieldCheck, Activity, Search, Globe, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { useRouter } from 'next/navigation';

export function SupervisorPanelClient() {
  const { userRole, loadingPermissions } = useInstitution();
  const router = useRouter();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deviceStats, setDeviceStats] = useState<Record<string, { total: number, online: number }>>({});
  const [loading, setLoading] = useState(true);

  // Verificación de Rol: Solo Supervisor o SuperAdmin
  useEffect(() => {
    if (!loadingPermissions && userRole !== 'supervisor' && userRole !== 'director-supervisor' && userRole !== 'super-admin') {
      router.push('/dashboard/unauthorized');
    }
  }, [userRole, loadingPermissions, router]);

  // 1. Cargar Instituciones - Ordenar por InstitutoId
  useEffect(() => {
    const q = query(collection(db, "institutions"), orderBy("InstitutoId", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const institutionsData = snapshot.docs.map(d => ({ 
        id: d.id,
        ...d.data() 
      }));
      setInstitutions(institutionsData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Cargar estadísticas de dispositivos desde RTDB para el resumen
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
          if (now - lastSeen < 45000) {
            stats[instId].online++;
          }
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
    <div className="p-8 space-y-10 animate-in fade-in duration-700">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] italic">Red Nacional de Control</span>
        </div>
        <h1 className="text-5xl font-black italic uppercase text-white tracking-tighter leading-none">
          Director <span className="text-orange-500">Supervisor</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-4 border-l-2 border-orange-500/30 pl-4">
          Supervisión de Nodos Institucionales y Personal Docente
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text"
          placeholder="BUSCAR SEDE O CÓDIGO..."
          className="w-full bg-[#0f1117] border border-slate-800 rounded-2xl py-5 pl-12 pr-6 text-white text-xs font-black uppercase outline-none focus:border-orange-500 transition-all shadow-2xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-white/5 rounded-[2.5rem] animate-pulse border border-white/5" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-800 rounded-[3rem]">
            <p className="text-slate-600 font-black uppercase italic tracking-widest">No se encontraron instituciones en la red</p>
          </div>
        ) : (
          filtered.map((inst) => {
            const stats = deviceStats[inst.InstitutoId] || { total: 0, online: 0 };
            return (
              <Link 
                key={inst.id} 
                href={`/dashboard/supervisor/${inst.InstitutoId}`}
                className="group bg-[#0f1117] border border-slate-800 p-8 rounded-[3rem] hover:border-orange-500/50 transition-all shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Building2 size={100} />
                </div>

                <div className="flex justify-between items-start mb-8">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 group-hover:border-orange-500/30 transition-all">
                    <Building2 className="text-orange-500" size={24} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stats.online > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                    <span className="text-[8px] font-black text-slate-500 uppercase italic">Sede Sincronizada</span>
                  </div>
                </div>

                <h3 className="text-2xl font-black italic uppercase text-white mb-2 tracking-tighter truncate leading-none">
                  {inst.InstitutoId || inst.nombre || 'Sede sin nombre'}
                </h3>
                <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-8">
                  ID: {inst.InstitutoId}
                </p>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                  <div>
                    <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Terminales</p>
                    <p className="text-lg font-black text-white italic">{stats.total}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-600 uppercase mb-1">En Línea</p>
                    <p className="text-lg font-black text-green-500 italic">{stats.online}</p>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between text-[10px] font-black uppercase italic text-slate-500 group-hover:text-white transition-colors">
                  <span>Ingresar al Monitor</span>
                  <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
