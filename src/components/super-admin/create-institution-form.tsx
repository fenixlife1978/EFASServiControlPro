'use client';
import React, { useState } from 'react';
import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Plus } from 'lucide-react';

export default function CreateInstitutionForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', InstitutoId: '', ubicacion: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.InstitutoId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "institutions"), {
        nombre: formData.nombre,
        InstitutoId: formData.InstitutoId.toUpperCase().trim(),
        ubicacion: formData.ubicacion,
        status: 'active',
        createdAt: serverTimestamp()
      });
      setFormData({ nombre: '', InstitutoId: '', ubicacion: '' });
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const inputStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-2xl focus:border-orange-500 outline-none font-bold text-slate-200 text-xs transition-all placeholder:text-slate-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-[8px] font-black uppercase text-slate-500 ml-2 tracking-widest">Nombre de la Sede</label>
        <input required className={inputStyle} value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} placeholder="EJ: COLEGIO CENTRAL" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[8px] font-black uppercase text-slate-500 ml-2 tracking-widest">ID Instituto</label>
          <input required className={inputStyle} value={formData.InstitutoId} onChange={(e) => setFormData({...formData, InstitutoId: e.target.value})} placeholder="CBT-001" />
        </div>
        <div className="space-y-2">
          <label className="text-[8px] font-black uppercase text-slate-500 ml-2 tracking-widest">Ubicación</label>
          <input className={inputStyle} value={formData.ubicacion} onChange={(e) => setFormData({...formData, ubicacion: e.target.value})} placeholder="Sede Norte" />
        </div>
      </div>
      <button disabled={loading} type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black italic uppercase py-5 rounded-2xl transition-all shadow-lg shadow-orange-500/10 flex items-center justify-center gap-3 text-xs mt-4">
        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
        Desplegar Sede
      </button>
    </form>
  );
}
