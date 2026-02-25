'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, setDoc, doc, onSnapshot, query } from 'firebase/firestore';
import { Loader2, UserPlus, ShieldCheck } from 'lucide-react';

export default function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    nombre: '', 
    email: '', 
    role: 'director', 
    InstitutoId: '',
    aulaId: '',
    seccion: ''
  });
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);

  // Cargar instituciones
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "institutions")), (snapshot) => {
      setInstitutions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Cargar aulas cuando cambia la institución
  useEffect(() => {
    if (!formData.InstitutoId) {
      setAulas([]);
      return;
    }
    const unsub = onSnapshot(collection(db, "institutions", formData.InstitutoId, "Aulas"), (snapshot) => {
      setAulas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [formData.InstitutoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.InstitutoId) return;
    setLoading(true);

    try {
      // Generar ID limpio: "Juan Pérez" -> "juan_perez"
      const customId = formData.nombre
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      
      const userRef = doc(db, "usuarios", customId);
      await setDoc(userRef, {
        id: customId,
        nombre: formData.nombre.trim(),
        email: formData.email.toLowerCase().trim(),
        role: formData.role,
        InstitutoId: formData.InstitutoId,
        aulaId: formData.aulaId,
        seccion: formData.seccion,
        createdAt: new Date(),
        status: 'active'
      });
      
      setFormData({ nombre: '', email: '', role: 'director', InstitutoId: '', aulaId: '', seccion: '' });
      alert("✅ USUARIO CREADO CON ID: " + customId);
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
          <option value="director" style={{color: 'white', backgroundColor: '#1a1d26'}}>Director</option>
          <option value="profesor" style={{color: 'white', backgroundColor: '#1a1d26'}}>Profesor</option>
        </select>
        
        <select required className={selectStyle} value={formData.InstitutoId} onChange={(e) => setFormData({...formData, InstitutoId: e.target.value, aulaId: '', seccion: ''})}>
          <option value="" style={{color: 'white', backgroundColor: '#1a1d26'}}>Seleccionar Sede</option>
          {institutions.map(inst => (
            <option key={inst.id} value={inst.id} style={{color: 'white', backgroundColor: '#1a1d26'}}>{inst.nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <select className={selectStyle} value={formData.seccion} onChange={(e) => setFormData({...formData, seccion: e.target.value, aulaId: ''})}>
          <option value="" style={{color: 'white', backgroundColor: '#1a1d26'}}>Sección (Opcional)</option>
          {[...new Set(aulas.map(a => a.seccion))].filter(Boolean).map(sec => (
            <option key={sec} value={sec} style={{color: 'white', backgroundColor: '#1a1d26'}}>{sec}</option>
          ))}
        </select>

        <select className={selectStyle} value={formData.aulaId} onChange={(e) => setFormData({...formData, aulaId: e.target.value})}>
          <option value="" style={{color: 'white', backgroundColor: '#1a1d26'}}>Aula (Opcional)</option>
          {aulas.filter(a => !formData.seccion || a.seccion === formData.seccion).map(aula => (
            <option key={aula.id} value={aula.id} style={{color: 'white', backgroundColor: '#1a1d26'}}>{aula.aulaId || aula.nombre || aula.id}</option>
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
