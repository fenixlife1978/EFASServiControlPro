'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, addDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Loader2, UserPlus, ShieldCheck } from 'lucide-react';

export default function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    nombre: '', 
    email: '', 
    role: 'director', 
    InstitutoId: '' 
  });
  const [institutions, setInstitutions] = useState<any[]>([]);

  // 1. Cargar lista de instituciones para el select
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "institutions")), (snapshot) => {
      setInstitutions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.InstitutoId) return;
    setLoading(true);

    try {
      // 2. Guardar en la colección global de usuarios
      await addDoc(collection(db, "usuarios"), {
        nombre: formData.nombre,
        email: formData.email.toLowerCase().trim(),
        role: formData.role,
        InstitutoId: formData.InstitutoId, // VINCULACIÓN MAESTRA
        createdAt: new Date()
      });
      
      setFormData({ nombre: '', email: '', role: 'director', InstitutoId: '' });
      alert("Usuario creado y vinculado correctamente");
    } catch (error) {
      console.error("Error:", error);
      alert("Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-xs transition-all placeholder:text-slate-600";
  const selectStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-xs transition-all appearance-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="text-orange-500 w-5 h-5" />
        <h3 className="text-sm font-black uppercase text-white tracking-widest italic">Nuevo Operador</h3>
      </div>
      
      <input required className={inputStyle} value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} placeholder="NOMBRE COMPLETO" />
      <input required type="email" className={inputStyle} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="CORREO ELECTRÓNICO" />
      
      <div className="grid grid-cols-2 gap-4">
        <select className={selectStyle} value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
          <option value="director">Director</option>
          <option value="profesor">Profesor</option>
        </select>
        
        {/* SELECTOR DE INSTITUCIÓN (VINCULACIÓN) */}
        <select required className={selectStyle} value={formData.InstitutoId} onChange={(e) => setFormData({...formData, InstitutoId: e.target.value})}>
          <option value="">Seleccionar Sede</option>
          {institutions.map(inst => (
            <option key={inst.InstitutoId} value={inst.InstitutoId}>{inst.nombre} ({inst.InstitutoId})</option>
          ))}
        </select>
      </div>

      <button disabled={loading} type="submit" className="w-full bg-slate-900 hover:bg-orange-500 text-white font-black italic uppercase py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 text-xs mt-4 border border-slate-800">
        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
        Vincular al Sistema
      </button>
    </form>
  );
}
