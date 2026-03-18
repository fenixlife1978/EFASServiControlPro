'use client';

import React, { useState, useEffect } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query } from 'firebase/firestore';
import { ref, set, update, remove, onValue } from 'firebase/database';
import { Building2, Plus, Trash2, Activity, Tablet, Clock, ShieldCheck, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";
import { Logo } from '@/components/common/logo';

export default function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [connections, setConnections] = useState<any>({});
  const [stats, setStats] = useState({ online: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [newInstitution, setNewInstitution] = useState({ name: '', email: '', id: '' });
  const { toast } = useToast();

  useEffect(() => {
    // 1. Escuchar Instituciones (Firestore)
    const q = query(collection(db, 'institutions'));
    const unsubFirestore = onSnapshot(q, (snapshot) => {
      const instList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInstitutions(instList);
      setLoading(false);
    });

    // 2. Escuchar Presencia de Tablets (RTDB)
    const devicesRef = ref(rtdb, 'dispositivos');
    const unsubRTDB = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val() || {};
      setConnections(data);
      
      const devicelist = Object.values(data);
      const onlineCount = devicelist.filter((d: any) => d.estado === 'activo').length;
      setStats({ online: onlineCount, total: devicelist.length });
    });

    return () => {
      unsubFirestore();
      unsubRTDB();
    };
  }, []);

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstitution.name || !newInstitution.id) return;
    
    const instId = newInstitution.id.trim().toUpperCase();

    try {
      await setDoc(doc(db, 'institutions', instId), {
        ...newInstitution,
        id: instId,
        createdAt: serverTimestamp(),
        isActive: true
      });

      await set(ref(rtdb, `config/instituciones/${instId}`), {
        nombre: newInstitution.name,
        activo: true,
        lastUpdate: new Date().toISOString()
      });

      setNewInstitution({ name: '', email: '', id: '' });
      toast({ title: "Protocolo Exitoso", description: "Sede integrada correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "Fallo en la propagación de datos.", variant: "destructive" });
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await updateDoc(doc(db, 'institutions', id), { isActive: newStatus });
      await update(ref(rtdb, `config/instituciones/${id}`), { activo: newStatus });
      toast({ title: "Estado Sincronizado", description: `Sede ${id} actualizada.` });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      document.cookie = "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      localStorage.removeItem('userRole');
      localStorage.removeItem('InstitutoId');
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans selection:bg-orange-500/30">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
          <div className="flex items-center gap-4">
            <Logo className="h-10" />
            <div className="h-8 w-[1px] bg-white/10 hidden md:block" />
            <div className="text-left">
              <h2 className="text-[10px] font-black tracking-[0.3em] text-orange-500 uppercase italic">Super-Admin</h2>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Global Control Infrastructure</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="ghost" className="hover:bg-red-500/10 text-slate-500 hover:text-red-500 text-[10px] font-black tracking-widest uppercase transition-all">
            Finalizar Sesión
          </Button>
        </div>

        {/* REGISTRO DE INSTITUCIONES */}
        <div className="mb-12">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-6">
            Desplegar Nueva <span className="text-orange-500">Institución</span>
          </h1>
          <form onSubmit={handleCreateInstitution} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#0a0c10] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Nombre Comercial</label>
              <input 
                placeholder="Ej: Colegio San José" 
                className="w-full bg-white/5 border border-white/5 p-4 rounded-xl text-xs focus:border-orange-500/50 transition-all outline-none"
                value={newInstitution.name}
                onChange={e => setNewInstitution({...newInstitution, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Identificador (ID)</label>
              <input 
                placeholder="COLEGIO-SJ" 
                className="w-full bg-white/5 border border-white/5 p-4 rounded-xl text-xs focus:border-orange-500/50 transition-all outline-none"
                value={newInstitution.id}
                onChange={e => setNewInstitution({...newInstitution, id: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Email Contacto</label>
              <input 
                placeholder="admin@sede.com" 
                className="w-full bg-white/5 border border-white/5 p-4 rounded-xl text-xs focus:border-orange-500/50 transition-all outline-none"
                value={newInstitution.email}
                onChange={e => setNewInstitution({...newInstitution, email: e.target.value})}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full h-[52px] bg-orange-600 hover:bg-orange-500 text-white font-black italic uppercase text-[10px] rounded-xl">
                Activar Sede
              </Button>
            </div>
          </form>
        </div>

        {/* MONITOR DE CONEXIÓN EN TIEMPO REAL */}
        <div className="mb-12 p-8 bg-[#0a0c10]/50 border border-orange-500/10 rounded-[2.5rem]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Activity className="text-orange-500 h-5 w-5 animate-pulse" />
              <h2 className="text-xl font-black italic uppercase tracking-tighter">Estado de Tablets Live</h2>
            </div>
            <div className="flex gap-4">
              <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-1 rounded-full">
                <span className="text-[10px] font-black text-orange-500 uppercase">En Línea: {stats.online}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(connections).map(([id, data]: [string, any]) => (
              <div key={id} className={`p-4 rounded-2xl border transition-all ${data.estado === 'activo' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-zinc-900/20 border-white/5 opacity-50'}`}>
                <div className="flex justify-between items-start mb-3">
                  <Tablet size={16} className={data.estado === 'activo' ? 'text-orange-500' : 'text-slate-600'} />
                  <div className={`h-2 w-2 rounded-full ${data.estado === 'activo' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>
                <p className="text-[10px] font-black uppercase truncate">{data.alumno_asignado || 'Terminal Shield'}</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase truncate">{data.institutoNombre || 'Sede Remota'}</p>
                <div className="mt-4 pt-2 border-t border-white/5 flex justify-between items-center text-[7px] text-slate-600 font-bold uppercase">
                  <div className="flex items-center gap-1"><Clock size={10} /> {data.ultimoAcceso ? new Date(data.ultimoAcceso).toLocaleTimeString() : '--:--'}</div>
                  <span>ID:{id.slice(-4)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LISTA DE INSTITUCIONES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {institutions.map((inst) => (
            <div key={inst.id} className="group flex items-center justify-between p-6 bg-[#0a0c10] border border-white/5 rounded-[2rem] hover:border-orange-500/20 transition-all">
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${inst.isActive ? 'bg-orange-500/10' : 'bg-slate-800/50'}`}>
                  <Building2 className={`h-6 w-6 ${inst.isActive ? 'text-orange-500' : 'text-slate-600'}`} />
                </div>
                <div>
                  <h3 className="font-black italic uppercase text-sm tracking-tight">{inst.name}</h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{inst.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Switch 
                  checked={inst.isActive} 
                  onCheckedChange={() => toggleStatus(inst.id, inst.isActive)}
                  className="data-[state=checked]:bg-orange-600"
                />
                <Button variant="ghost" size="icon" className="text-slate-700 hover:text-red-500" onClick={() => {
                  if(confirm(`Eliminar ${inst.name}?`)) {
                    deleteDoc(doc(db, 'institutions', inst.id));
                    remove(ref(rtdb, `config/instituciones/${inst.id}`));
                  }
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
