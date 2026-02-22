'use client';
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useInstitution } from '../institution-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function GestionAulas() {
  const { institutionId } = useInstitution();
  const [aulas, setAulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newAula, setNewAula] = useState({ nombre_completo: '', seccion: '', grado: '' });
  const router = useRouter();

  useEffect(() => {
    if (!institutionId) return;
    const path = `institutions/${institutionId}/Aulas`;
    const colRef = collection(db, path);
    const unsub = onSnapshot(colRef, (snaps) => {
      const lista = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      setAulas(lista);
      setLoading(false);
    });
    return () => unsub();
  }, [institutionId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.nombre_completo || !institutionId) return;
    
    try {
      const path = `institutions/${institutionId}/Aulas`;
      await addDoc(collection(db, path), {
        ...newAula,
        status: 'published',
        createdAt: serverTimestamp(),
        InstitutoId: institutionId
      });
      setShowModal(false);
      setNewAula({ nombre_completo: '', seccion: '', grado: '' });
    } catch (error) {
      console.error("Error al crear aula:", error);
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start mb-12">
        <header>
          <h1 className="text-5xl font-black italic uppercase text-slate-900 tracking-tighter">
            Control de <span className="text-orange-500">Aulas</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 italic">
            EDU ServControlPro • {institutionId}
          </p>
        </header>

        <button 
          onClick={() => setShowModal(true)}
          className="bg-orange-500 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs transition-all shadow-lg shadow-orange-200"
        >
          + Nueva Aula
        </button>
      </div>

      {loading ? (
        <div className="font-black italic text-slate-300 uppercase animate-pulse">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {aulas.map((aula) => (
            <div key={aula.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm hover:border-orange-500 transition-all group">
              <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full mb-4 inline-block italic">
                {aula.status || 'Publicado'}
              </span>
              <h3 className="text-2xl font-black italic uppercase text-slate-800 leading-tight mb-2">
                {aula.nombre_completo}
              </h3>
              <p className="text-slate-400 font-bold uppercase text-[10px] mb-6 italic">
                Sección: {aula.seccion} • Grado: {aula.grado}
              </p>
              <Link href={`/dashboard/classrooms/view?id=${aula.id}`} className="inline-flex items-center justify-center w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase italic text-xs">
                Ver Dispositivos →
              </Link>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl">
            <h2 className="text-3xl font-black italic uppercase mb-6 text-slate-900">Registrar <span className="text-orange-500">Aula</span></h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input 
                placeholder="NOMBRE COMPLETO"
                className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold text-sm text-slate-900"
                value={newAula.nombre_completo}
                onChange={e => setNewAula({...newAula, nombre_completo: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="SECCIÓN"
                  className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold text-sm text-slate-900"
                  value={newAula.seccion}
                  onChange={e => setNewAula({...newAula, seccion: e.target.value})}
                />
                <input 
                  placeholder="GRADO"
                  className="w-full p-4 bg-slate-50 rounded-xl border-none font-bold text-sm text-slate-900"
                  value={newAula.grado}
                  onChange={e => setNewAula({...newAula, grado: e.target.value})}
                />
              </div>
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 font-black uppercase italic text-xs text-slate-400">Cancelar</button>
                <button type="submit" className="flex-1 bg-orange-500 text-white p-4 rounded-xl font-black uppercase italic text-xs">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
