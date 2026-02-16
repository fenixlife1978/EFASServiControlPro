'use client';

import React, { useState, useEffect } from 'react';
import { db, logout } from '@/firebase'; // Importamos el logout optimizado de index.ts
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query } from 'firebase/firestore';
import { Building2, Plus, Trash2, LogOut, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';

export default function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ nombre: '', institutoId: '', logoUrl: '' });
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, "institutions"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          nombre: data.nombre || "Sin nombre", 
          institutoId: data.InstitutoId || doc.id, 
          status: data.status || 'published',
          ...data
        };
      });
      setInstitutions(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Función de cierre de sesión corregida
  const handleLogout = async () => {
    try {
      // El logout de nuestro index.ts ya limpia localStorage y redirige
      await logout();
    } catch (error) {
      console.error("Error al salir:", error);
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "No se pudo cerrar la sesión correctamente." 
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.institutoId) return;
    
    try {
      const customId = formData.institutoId.trim().toUpperCase();
      const docRef = doc(db, "institutions", customId);
      
      await setDoc(docRef, {
        nombre: formData.nombre,
        InstitutoId: customId,
        logoUrl: formData.logoUrl,
        status: 'published',
        createdAt: serverTimestamp(),
      });
      
      toast({ title: "Éxito", description: "Institución registrada correctamente" });
      setFormData({ nombre: '', institutoId: '', logoUrl: '' });
    } catch (e) {
      toast({ title: "Error", description: "Fallo al registrar" });
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'unpublished' : 'published';
    try {
      await updateDoc(doc(db, "institutions", id), { status: newStatus });
    } catch (e) {
      toast({ title: "Error", description: "No se pudo cambiar el estado" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro que deseas eliminar esta institución?")) return;
    try {
      await deleteDoc(doc(db, "institutions", id));
      toast({ title: "Eliminada", description: "Registro borrado permanentemente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-6 font-sans">
      <header className="flex justify-between items-center max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black italic tracking-tighter uppercase">
            EFAS <span className="text-orange-500">ServiControlPro</span>
          </h1>
        </div>
        
        {/* Botón de SALIR Actualizado */}
        <Button 
          onClick={handleLogout} 
          variant="destructive" 
          size="sm" 
          className="bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 italic font-black rounded-lg px-6 transition-all"
        >
          <LogOut className="w-4 h-4 mr-2" /> SALIR
        </Button>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        <section className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">Nombre</label>
              <input 
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value})}
                className="w-full bg-[#1c212c] rounded-xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-200"
                placeholder="Nombre de la Institución"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">InstitutoId</label>
              <input 
                value={formData.institutoId}
                onChange={e => setFormData({...formData, institutoId: e.target.value})}
                className="w-full bg-[#1c212c] rounded-xl py-4 px-4 text-sm font-mono text-orange-400 outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="CAG-001"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">URL Logo</label>
              <input 
                value={formData.logoUrl}
                onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                className="w-full bg-[#1c212c] rounded-xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-black italic rounded-2xl py-7 uppercase shadow-lg shadow-orange-900/20">
              <Plus className="w-5 h-5 mr-2" /> REGISTRAR
            </Button>
          </form>
        </section>

        <section className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-800 text-[11px] font-black uppercase">
                <th className="px-8 py-5">Institución</th>
                <th className="px-8 py-5">InstitutoId</th>
                <th className="px-8 py-5">Estado</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 font-bold">
              {institutions.map((inst) => (
                <tr key={inst.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6 text-slate-900">{inst.nombre}</td>
                  <td className="px-8 py-6">
                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-md text-xs font-black">
                      {inst.InstitutoId}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={inst.status === 'published'} 
                        onCheckedChange={() => toggleStatus(inst.id, inst.status)}
                      />
                      <span className={`text-[10px] font-black uppercase ${inst.status === 'published' ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {inst.status === 'published' ? '● Publicado' : '○ Borrador'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end items-center gap-2">
                        <Button 
                            onClick={() => {
                                localStorage.setItem('selectedInstitutionId', inst.id);
                                router.push('/dashboard');
                            }}
                            variant="outline" 
                            className="border-orange-200 text-orange-600 font-black italic text-xs rounded-xl uppercase hover:bg-orange-50"
                        >
                            <ExternalLink className="w-3 h-3 mr-2" /> GESTIONAR
                        </Button>
                        <Button
                            onClick={() => handleDelete(inst.id)}
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="p-10 text-center font-black text-slate-300">CARGANDO...</div>}
        </section>
      </main>
    </div>
  );
}
