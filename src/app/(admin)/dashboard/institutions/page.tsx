'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { School, Plus, Hash, Loader2, ShieldCheck } from 'lucide-react';

export default function InstitutionsPage() {
  const [institutos, setInstitutos] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [customId, setCustomId] = useState(''); // Tu lógica de ID manual
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Escuchamos la colección 'institutos'
    const q = query(collection(db, "institutos"));
    const unsub = onSnapshot(q, (snaps) => {
      setInstitutos(snaps.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !customId.trim()) return;
    setLoading(true);

    try {
      // USAMOS setDoc para que el ID del documento sea el que TÚ definas
      await setDoc(doc(db, "institutos", customId.trim()), {
        nombre: nombre.trim(),
        InstitutoId: customId.trim(), // Lo guardamos también dentro por si acaso
        createdAt: serverTimestamp(),
        status: 'active'
      });
      setNombre('');
      setCustomId('');
      alert("Instituto creado con éxito");
    } catch (error) {
      console.error(error);
      alert("Error al crear: " + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black italic uppercase text-slate-900 tracking-tighter">
            Control de <span className="text-orange-500">Instituciones</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">
            Configuración Rooted de EDUControlPro Sistema de Control Parental Educativo
          </p>
        </div>
        <div className="bg-orange-500 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase italic tracking-widest">
            Super Admin Access
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario con ID Manual */}
        <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)]">
          <h2 className="font-black italic uppercase text-xs mb-6 flex items-center gap-2">
            <Plus className="w-4 h-4 text-orange-500" /> Registrar Nuevo Colegio
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">ID del Instituto (Manual)</label>
              <input 
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mt-1 font-bold focus:border-orange-500 outline-none transition-all uppercase"
                placeholder="EJ: COLEGIO-VALLE-01"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre Comercial</label>
              <input 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mt-1 font-bold focus:border-orange-500 outline-none transition-all"
                placeholder="Nombre del Colegio"
                required
              />
            </div>
            <button 
              disabled={loading}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase italic text-xs hover:bg-orange-500 transition-all"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : "Vincular al Sistema"}
            </button>
          </form>
        </div>

        {/* Lista de Institutos Registrados */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 ml-4">Institutos en Red</h3>
          {institutos.length === 0 && (
            <div className="p-10 border-2 border-dashed rounded-[3rem] text-center text-slate-300 font-bold uppercase italic text-sm">
                No hay institutos registrados en esta colección
            </div>
          )}
          {institutos.map(inst => (
            <div key={inst.id} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] flex items-center justify-between group hover:shadow-xl transition-all">
              <div className="flex items-center gap-5">
                <div className="bg-orange-500/10 p-4 rounded-2xl">
                  <School className="text-orange-500 w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black italic uppercase text-slate-800 text-lg">{inst.nombre}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                      <Hash className="w-3 h-3" /> {inst.id}
                    </span>
                    <span className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verificado
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
