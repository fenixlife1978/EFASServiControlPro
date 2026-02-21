'use client';
import React, { useState } from 'react';
import { db } from '@/firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, Plus } from 'lucide-react';

export default function CreateInstitutionForm() {
  const [formData, setFormData] = useState({ manualId: '', nombre: '', direccion: '', telefono: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.manualId || !formData.nombre) return alert("El ID y el Nombre son obligatorios");
    setIsSaving(true);
    try {
      // El ID del documento será manualId, pero el campo interno será InstitutoId
      await setDoc(doc(db, "institutions", formData.manualId.trim()), {
        InstitutoId: formData.manualId.trim(),
        nombre: formData.nombre,
        direccion: formData.direccion,
        telefono: formData.telefono,
        createdAt: serverTimestamp(),
        status: 'active'
      });
      setFormData({ manualId: '', nombre: '', direccion: '', telefono: '' });
      alert("✅ Sede creada con éxito. ID: " + formData.manualId);
    } catch (error) {
      console.error(error);
      alert("Error al crear la sede");
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase transition-all";

  return (
    <section className="bg-[#0f1117] p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
      <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3">
        <Building2 className="text-orange-500 w-5 h-5" /> Nueva Sede
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">ID Manual (InstitutoId)</label>
          <input className={inputStyle} value={formData.manualId} onChange={e => setFormData({...formData, manualId: e.target.value})} placeholder="EJ: SC-005..." />
        </div>
        <div>
          <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Nombre del Instituto</label>
          <input className={inputStyle} value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="NOMBRE DE LA SEDE..." />
        </div>
        <button type="submit" disabled={isSaving} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl text-[10px] uppercase italic transition-all flex items-center justify-center gap-2">
          {isSaving ? 'CREANDO...' : <><Plus size={16}/> CREAR INSTITUCIÓN</>}
        </button>
      </form>
    </section>
  );
}
