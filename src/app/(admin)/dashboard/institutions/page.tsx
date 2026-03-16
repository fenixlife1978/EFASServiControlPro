'use client';
import React, { useState, useEffect } from 'react';
// MIGRACIÓN: Importamos RTDB
import { rtdb } from '@/firebase/config';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { School, Plus, Hash, Loader2, ShieldCheck } from 'lucide-react';

export default function InstitutionsPage() {
  const [institutos, setInstitutos] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [customId, setCustomId] = useState(''); // Lógica de ID manual
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Escuchamos el nodo 'instituciones' en RTDB
    const instRef = ref(rtdb, "instituciones");
    
    const unsub = onValue(instRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convertimos el objeto JSON en un array para el renderizado
        const lista = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setInstitutos(lista);
      } else {
        setInstitutos([]);
      }
    });

    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !customId.trim()) return;
    setLoading(true);

    try {
      // En RTDB usamos 'set' indicando la ruta con el ID manual
      // Ruta: instituciones/ID-MANUAL
      const newInstRef = ref(rtdb, `instituciones/${customId.trim()}`);
      
      await set(newInstRef, {
        nombre: nombre.trim(),
        InstitutoId: customId.trim(),
        createdAt: serverTimestamp(), // RTDB también tiene serverTimestamp
        status: 'active'
      });

      setNombre('');
      setCustomId('');
      // Usamos una notificación más elegante si tienes Toast, si no, alert está bien
      alert("Instituto vinculado exitosamente al nodo RTDB");
    } catch (error) {
      console.error(error);
      alert("Error en despliegue de nodo: " + error);
    } finally {
      setLoading(false); // CORREGIDO: eliminado setLoadingPermissions
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
            Configuración Rooted de EFAS ServiControlPro • Core Administrativo
          </p>
        </div>
        <div className="bg-orange-500 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase italic tracking-widest shadow-lg shadow-orange-500/20">
            Super Admin Access
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Formulario con ID Manual - Estilo Bento EFAS */}
        <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] h-fit">
          <h2 className="font-black italic uppercase text-xs mb-8 flex items-center gap-2 text-slate-700">
            <Plus className="w-4 h-4 text-orange-500" /> Registrar Nuevo Colegio
          </h2>
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">ID del Instituto (Manual)</label>
              <input 
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mt-1 font-bold focus:border-orange-500 outline-none transition-all uppercase placeholder:text-slate-300 shadow-inner"
                placeholder="EJ: COLEGIO-VALLE-01"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nombre Comercial</label>
              <input 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mt-1 font-bold focus:border-orange-500 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="Nombre de la Institución"
                required
              />
            </div>
            <button 
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase italic text-xs hover:bg-orange-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : "Vincular al Sistema RTDB"}
            </button>
          </form>
        </div>

        {/* Lista de Institutos Registrados */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-6 px-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Institutos en Red</h3>
            <span className="text-[10px] font-black text-slate-300 uppercase italic">Total: {institutos.length}</span>
          </div>
          
          {institutos.length === 0 && (
            <div className="p-20 border-4 border-dashed rounded-[4rem] text-center text-slate-200 font-black uppercase italic text-sm">
                Esperando despliegue de nodos...
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {institutos.map(inst => (
              <div key={inst.id} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] flex items-center justify-between group hover:shadow-2xl hover:border-orange-100 transition-all cursor-default shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="bg-slate-900 text-white p-5 rounded-3xl group-hover:bg-orange-500 transition-colors shadow-lg">
                    <School className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black italic uppercase text-slate-800 text-xl tracking-tighter leading-tight">{inst.nombre}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 border border-slate-200">
                        <Hash className="w-3 h-3 text-orange-500" /> {inst.id}
                      </span>
                      <span className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1 bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                        <ShieldCheck className="w-3 h-3" /> Nodo Activo
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
