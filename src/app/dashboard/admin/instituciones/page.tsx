'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Building2, Plus, Edit3, Trash2, ShieldCheck, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";

export default function InstitucionesPage() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', adminEmail: '' });
  const firestore = useFirestore();
  const { toast } = useToast();

  // 1. Leer Instituciones [cite: 2026-01-27]
  const fetchInstitutions = async () => {
    if (!firestore) {
      toast({ title: "Error", description: "Servicio de base de datos no disponible.", variant: "destructive" });
      setLoading(false);
      return;
    }
    try {
      const querySnapshot = await getDocs(collection(firestore, "institutions"));
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInstitutions(docs);
    } catch (e) {
      toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInstitutions(); }, [firestore]);

  // 2. Crear o Actualizar [cite: 2026-02-11]
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    try {
      if (isEditing) {
        const docRef = doc(firestore, "institutions", isEditing);
        await updateDoc(docRef, { ...formData, updatedAt: serverTimestamp() });
        toast({ title: "Actualizado", description: "Institución modificada con éxito" });
      } else {
        await addDoc(collection(firestore, "institutions"), {
          ...formData,
          createdAt: serverTimestamp(),
          status: 'active'
        });
        toast({ title: "Creado", description: "Nueva institución EFAS dada de alta" });
      }
      setFormData({ name: '', adminEmail: '' });
      setIsEditing(null);
      fetchInstitutions();
    } catch (e) {
      toast({ title: "Error", description: "Operación fallida", variant: "destructive" });
    }
  };

  // 3. Eliminar [cite: 2026-01-27]
  const handleDelete = async (id: string) => {
    if (!firestore) return;
    if (!confirm("¿Estás seguro? Se borrarán todos los datos vinculados a este ID.")) return;
    try {
      await deleteDoc(doc(firestore, "institutions", id));
      toast({ title: "Eliminado", description: "Institución removida del sistema" });
      fetchInstitutions();
    } catch (e) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tighter italic text-slate-900">
            GESTIÓN DE <span className="text-orange-500">INSTITUCIONES</span>
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Panel Super Admin EFAS [cite: 2026-01-23]</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl h-fit">
          <h2 className="text-lg font-black italic uppercase mb-6 flex items-center gap-2">
            {isEditing ? <Edit3 className="text-orange-500"/> : <Plus className="text-orange-500"/>}
            {isEditing ? 'Editar Entidad' : 'Alta de Entidad'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Nombre del Colegio"
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
            <input 
              value={formData.adminEmail}
              onChange={e => setFormData({...formData, adminEmail: e.target.value})}
              placeholder="Email del Administrador"
              type="email"
              className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
            <div className="flex gap-2">
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase rounded-xl py-6">
                {isEditing ? 'Guardar Cambios' : 'Registrar'}
              </Button>
              {isEditing && (
                <Button type="button" onClick={() => setIsEditing(null)} variant="outline" className="rounded-xl py-6 font-black uppercase">Cancelar</Button>
              )}
            </div>
          </form>
        </div>

        {/* Tabla / Lista */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? <p className="font-black animate-pulse text-slate-400">CARGANDO BASE DE DATOS...</p> : 
            institutions.map((inst) => (
              <div key={inst.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-900 p-4 rounded-2xl text-orange-500">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black italic text-slate-900 uppercase leading-none">{inst.name}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">{inst.adminEmail}</p>
                    <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 mt-2 block w-fit">ID: {inst.id}</code>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setIsEditing(inst.id); setFormData({name: inst.name, adminEmail: inst.adminEmail}); }} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><Edit3 className="w-4 h-4"/></button>
                  <button onClick={() => handleDelete(inst.id)} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
