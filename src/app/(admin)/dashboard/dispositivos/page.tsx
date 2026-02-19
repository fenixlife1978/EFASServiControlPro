'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useInstitution } from '../institution-context';
import { Radio, Laptop, Smartphone, Tablet, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DispositivosPage() {
  const { institutionId } = useInstitution();
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!institutionId) return;
    const q = query(collection(db, "dispositivos"), where("InstitutoId", "==", institutionId));
    const unsub = onSnapshot(q, (snaps) => {
      setDispositivos(snaps.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [institutionId]);

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <button 
        onClick={() => router.back()}
        className="mb-8 flex items-center gap-3 text-slate-400 hover:text-orange-500 font-black uppercase text-[10px] tracking-widest transition-all group"
      >
        <span className="bg-white h-10 w-10 flex items-center justify-center rounded-full shadow-sm group-hover:shadow-orange-200 group-hover:scale-110 transition-all text-lg font-bold">
          ←
        </span>
        Volver al Panel
      </button>

      <header className="mb-12">
        <h1 className="text-5xl font-black italic uppercase text-slate-900 tracking-tighter">
          Gestión de <span className="text-orange-500">Dispositivos</span>
        </h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 italic">
          Hardware Vinculado • {institutionId}
        </p>
      </header>

      {loading ? (
        <div className="font-black italic text-slate-300 uppercase animate-pulse">Sincronizando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {dispositivos.map((disp) => (
            <div key={disp.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm">
              <div className="bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-slate-900">
                <Tablet className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black italic uppercase text-slate-800 mb-1">{disp.id}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase italic mb-6">Status: {disp.online ? 'En Línea' : 'Desconectado'}</p>
              <div className={`h-1.5 w-full rounded-full bg-slate-100 overflow-hidden`}>
                <div className={`h-full ${disp.online ? 'bg-green-500' : 'bg-slate-300'} transition-all`} style={{width: '100%'}}></div>
              </div>
            </div>
          ))}
          
          {dispositivos.length === 0 && (
            <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-200 rounded-[4rem]">
              <Radio className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="font-black italic text-slate-300 uppercase">No hay dispositivos vinculados aún</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
