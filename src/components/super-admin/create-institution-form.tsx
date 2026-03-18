'use client';
import React, { useState } from 'react';
import { db, rtdb } from '@/firebase/config'; // Importamos ambas bases de datos
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set } from 'firebase/database'; // Funciones de Realtime Database
import { Building2, Plus } from 'lucide-react';

export default function CreateInstitutionForm() {
  const [formData, setFormData] = useState({ manualId: '', nombre: '', direccion: '', telefono: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = formData.manualId.trim().toUpperCase(); // Normalizamos el ID

    if (!cleanId || !formData.nombre) return alert("El ID y el Nombre son obligatorios");
    
    setIsSaving(true);
    try {
      // 1. ESCRITURA EN FIRESTORE (Capa Administrativa de EDUControlPro)
      await setDoc(doc(db, "institutions", cleanId), {
        InstitutoId: cleanId,
        nombre: formData.nombre,
        direccion: formData.direccion,
        telefono: formData.telefono,
        createdAt: serverTimestamp(),
        status: 'active'
      });

      // 2. INICIALIZACIÓN EN REALTIME DATABASE (Capa de Control Táctico)
      // Creamos el nodo de control global para esta sede
      const instControlRef = ref(rtdb, `control_sedes/${cleanId}`);
      await set(instControlRef, {
        lock_all: false, // Switch maestro para bloquear toda la sede
        mensaje_global: "",
        last_update: Date.now(),
        nombre_sede: formData.nombre
      });

      setFormData({ manualId: '', nombre: '', direccion: '', telefono: '' });
      alert("✅ Sede EDUControlPro creada con éxito e inicializada en RTDB. ID: " + cleanId);
    } catch (error) {
      console.error("Error en la creación híbrida:", error);
      alert("Error al crear la sede");
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase transition-all";

  return (
    <section className="bg-[#0f1117] p-8 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden">
      {/* Glow de marca EDUControlPro */}
      <div className="absolute -top-10 -left-10 w-32 h-32 bg-orange-500/10 blur-[50px] pointer-events-none" />

      <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3 tracking-tighter">
        <Building2 className="text-orange-500 w-5 h-5" /> Nueva Sede <span className="text-orange-500">EDUControlPro</span>
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">ID Manual (Único)</label>
            <input 
              className={inputStyle} 
              value={formData.manualId} 
              onChange={e => setFormData({...formData, manualId: e.target.value})} 
              placeholder="EJ: SEDE-NORTE-01" 
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Nombre del Instituto</label>
            <input 
              className={inputStyle} 
              value={formData.nombre} 
              onChange={e => setFormData({...formData, nombre: e.target.value})} 
              placeholder="NOMBRE OFICIAL..." 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Dirección Física</label>
            <input 
              className={inputStyle} 
              value={formData.direccion} 
              onChange={e => setFormData({...formData, direccion: e.target.value})} 
              placeholder="UBICACIÓN..." 
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Teléfono de Contacto</label>
            <input 
              className={inputStyle} 
              value={formData.telefono} 
              onChange={e => setFormData({...formData, telefono: e.target.value})} 
              placeholder="CENTRALITA..." 
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSaving} 
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl text-[10px] uppercase italic transition-all flex items-center justify-center gap-2 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
        >
          {isSaving ? 'CONFIGURANDO SEDE HÍBRIDA...' : <><Plus size={16}/> CREAR INSTITUCIÓN</>}
        </button>
      </form>

      <p className="text-center text-[8px] text-slate-600 font-black uppercase mt-6 tracking-[0.3em]">
        Capa de Datos Dual: Firestore + Realtime Engine
      </p>
    </section>
  );
}
