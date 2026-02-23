'use client';

import React, { useState, useEffect } from 'react';
import { db, logout, auth } from '@/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query } from 'firebase/firestore';
import { Building2, Plus, Trash2, LogOut, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';

export default function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInstitution, setNewInstitution] = useState({ name: '', email: '', id: '' });
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, 'institutions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const instList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInstitutions(instList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstitution.name || !newInstitution.id) return;
    try {
      await setDoc(doc(db, 'institutions', newInstitution.id), {
        ...newInstitution,
        createdAt: serverTimestamp(),
        isActive: true
      });
      setNewInstitution({ name: '', email: '', id: '' });
      toast({ title: "Éxito", description: "Institución creada correctamente" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo crear la institución", variant: "destructive" });
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'institutions', id), { isActive: !currentStatus });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <Logo className="h-12" />
          <Button 
            onClick={() => { 
              auth.signOut().then(() => { 
                document.cookie = "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;"; 
                localStorage.clear(); 
                sessionStorage.clear(); 
                window.location.replace("/login"); 
              }); 
            }} 
            variant="destructive" 
            size="sm" 
            className="bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 italic font-black rounded-lg px-6 transition-all"
          >
            SALIR
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-8">Panel de Super Admin</h1>
        
        <form onSubmit={handleCreateInstitution} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
          <input 
            placeholder="Nombre Institución" 
            className="bg-black border border-zinc-700 p-2 rounded"
            value={newInstitution.name}
            onChange={e => setNewInstitution({...newInstitution, name: e.target.value})}
          />
          <input 
            placeholder="ID de Institución" 
            className="bg-black border border-zinc-700 p-2 rounded"
            value={newInstitution.id}
            onChange={e => setNewInstitution({...newInstitution, id: e.target.value})}
          />
          <input 
            placeholder="Email Contacto" 
            className="bg-black border border-zinc-700 p-2 rounded"
            value={newInstitution.email}
            onChange={e => setNewInstitution({...newInstitution, email: e.target.value})}
          />
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear Institución</Button>
        </form>

        <div className="grid gap-4">
          {institutions.map((inst) => (
            <div key={inst.id} className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
              <div>
                <h3 className="font-bold text-lg">{inst.name}</h3>
                <p className="text-zinc-500 text-sm">{inst.id} - {inst.email}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 uppercase">Estado</span>
                  <Switch 
                    checked={inst.isActive} 
                    onCheckedChange={() => toggleStatus(inst.id, inst.isActive)}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'institutions', inst.id))} className="text-red-500">
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
