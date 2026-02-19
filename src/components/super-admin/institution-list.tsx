'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { School, ArrowRight, Trash2 } from 'lucide-react';

export default function InstitutionList() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const { setInstitutionId } = useInstitution();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "institutions")), (snapshot) => {
      setInstitutions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="text-center py-20 animate-pulse font-black italic text-slate-700 uppercase text-xs">Escaneando Red...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {institutions.map((inst) => (
        <div key={inst.id} className="bg-[#1a1d26]/50 p-6 rounded-[2.5rem] border border-slate-800 hover:border-orange-500/50 transition-all group">
          <div className="flex justify-between items-center mb-6">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 group-hover:border-orange-500/30 transition-colors">
              <School className="w-5 h-5 text-slate-400 group-hover:text-orange-500" />
            </div>
            <div className="flex gap-2 items-center">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
               <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter italic">Online</span>
            </div>
          </div>
          <h3 className="text-lg font-black italic uppercase text-white mb-1 leading-tight">{inst.nombre}</h3>
          <p className="text-[9px] font-bold text-slate-600 uppercase italic mb-8 tracking-widest">Access Key: {inst.InstitutoId}</p>
          <div className="flex gap-2">
            <button onClick={() => setInstitutionId(inst.InstitutoId)} className="flex-1 bg-white text-black font-black italic uppercase text-[9px] py-3 rounded-xl hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2">
              Gestionar <ArrowRight className="w-3 h-3" />
            </button>
            <button className="bg-slate-900 p-3 rounded-xl text-slate-600 hover:text-red-500 border border-slate-800 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
