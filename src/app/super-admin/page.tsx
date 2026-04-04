'use client';

import React, { useState, useEffect } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { ref, set, update, remove, onValue, query as rtdbQuery, orderByChild } from 'firebase/database';
import { Building2, Plus, Trash2, Activity, Tablet, Clock, ShieldCheck, Globe, ShieldAlert, UserCog, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";
import { Logo } from '@/components/common/logo';

interface DeviceInfo {
  id: string;
  estado: string;
  alumno_asignado?: string;
  institutoNombre?: string;
  InstitutoId?: string;
  ultimoAcceso?: number;
  admin_mode_enable?: boolean;
  shield_mode_enable?: boolean;
  last_command_ts?: number;
}

interface Institution {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt?: any;
}

export default function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [stats, setStats] = useState({ online: 0, total: 0, protected: 0, techMode: 0 });
  const [loading, setLoading] = useState(true);
  const [newInstitution, setNewInstitution] = useState({ name: '', email: '', id: '' });
  const { toast } = useToast();

  useEffect(() => {
    // 1. Escuchar Instituciones (Firestore)
    const q = query(collection(db, 'institutions'), orderBy('createdAt', 'desc'));
    const unsubFirestore = onSnapshot(q, (snapshot) => {
      const instList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.id,
        email: doc.data().email || '',
        isActive: doc.data().isActive !== false,
        createdAt: doc.data().createdAt
      } as Institution));
      setInstitutions(instList);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando instituciones:", error);
    });

    // 2. Escuchar dispositivos desde RTDB con más información
    const devicesRef = ref(rtdb, 'dispositivos');
    const unsubRTDB = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val() || {};
      
      const deviceList: DeviceInfo[] = Object.entries(data).map(([id, value]: [string, any]) => ({
        id: id,
        estado: value.estado || 'inactivo',
        alumno_asignado: value.alumno_asignado || 'Sin asignar',
        institutoNombre: value.institutoNombre || 'Sede no definida',
        InstitutoId: value.InstitutoId || '',
        ultimoAcceso: value.ultimoAcceso || value.last_command_ts || Date.now(),
        admin_mode_enable: value.admin_mode_enable || false,
        shield_mode_enable: value.shield_mode_enable || false,
        last_command_ts: value.last_command_ts
      }));
      
      setDevices(deviceList);
      
      // Calcular estadísticas
      const onlineCount = deviceList.filter(d => d.estado === 'activo').length;
      const protectedCount = deviceList.filter(d => d.shield_mode_enable === true).length;
      const techModeCount = deviceList.filter(d => d.admin_mode_enable === true).length;
      
      setStats({
        online: onlineCount,
        total: deviceList.length,
        protected: protectedCount,
        techMode: techModeCount
      });
    }, (error) => {
      console.error("Error cargando dispositivos:", error);
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
      // Crear en Firestore
      await setDoc(doc(db, 'institutions', instId), {
        id: instId,
        name: newInstitution.name,
        email: newInstitution.email,
        createdAt: serverTimestamp(),
        isActive: true,
        allowAccessGlobal: false,
        shieldModeGlobal: false
      });

      // Crear configuración en RTDB
      await set(ref(rtdb, `config/instituciones/${instId}`), {
        nombre: newInstitution.name,
        activo: true,
        allowAccessGlobal: false,
        shieldModeGlobal: false,
        lastUpdate: Date.now()
      });

      // Crear contador de dispositivos
      await set(ref(rtdb, `stats/instituciones/${instId}`), {
        total_devices: 0,
        active_devices: 0,
        created_at: Date.now()
      });

      setNewInstitution({ name: '', email: '', id: '' });
      toast({ 
        title: "Protocolo Exitoso", 
        description: `Sede ${newInstitution.name} integrada correctamente.`,
        variant: "default"
      });
    } catch (error) {
      console.error("Error creando institución:", error);
      toast({ 
        title: "Error", 
        description: "Fallo en la propagación de datos.", 
        variant: "destructive" 
      });
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await updateDoc(doc(db, 'institutions', id), { isActive: newStatus });
      await update(ref(rtdb, `config/instituciones/${id}`), { 
        activo: newStatus,
        lastUpdate: Date.now()
      });
      toast({ 
        title: "Estado Sincronizado", 
        description: `Sede ${id} ${newStatus ? 'activada' : 'desactivada'}.` 
      });
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
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

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '--:--';
    return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
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

        {/* ESTADÍSTICAS GLOBALES */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-[#0a0c10] border border-white/5 rounded-2xl p-6 text-center">
            <Tablet className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="text-2xl font-black text-white">{stats.total}</p>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Tablets</p>
          </div>
          <div className="bg-[#0a0c10] border border-white/5 rounded-2xl p-6 text-center">
            <Wifi className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-black text-white">{stats.online}</p>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">En Línea</p>
          </div>
          <div className="bg-[#0a0c10] border border-white/5 rounded-2xl p-6 text-center">
            <ShieldAlert className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-black text-white">{stats.protected}</p>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Modo Blindado</p>
          </div>
          <div className="bg-[#0a0c10] border border-white/5 rounded-2xl p-6 text-center">
            <UserCog className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-black text-white">{stats.techMode}</p>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Anulación Técnica</p>
          </div>
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
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Identificador (ID)</label>
              <input 
                placeholder="COLEGIO-SJ" 
                className="w-full bg-white/5 border border-white/5 p-4 rounded-xl text-xs focus:border-orange-500/50 transition-all outline-none"
                value={newInstitution.id}
                onChange={e => setNewInstitution({...newInstitution, id: e.target.value.toUpperCase()})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Email Contacto</label>
              <input 
                placeholder="admin@sede.com" 
                type="email"
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
            {devices.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-500 text-[10px] font-black uppercase">
                No hay dispositivos registrados
              </div>
            ) : (
              devices.map((device) => (
                <div key={device.id} className={`p-4 rounded-2xl border transition-all ${device.estado === 'activo' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-zinc-900/20 border-white/5 opacity-50'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {device.shield_mode_enable && <ShieldAlert className="w-3 h-3 text-orange-500" />}
                      {device.admin_mode_enable && <UserCog className="w-3 h-3 text-blue-500" />}
                      <Tablet size={14} className={device.estado === 'activo' ? 'text-orange-500' : 'text-slate-600'} />
                    </div>
                    <div className={`h-2 w-2 rounded-full ${device.estado === 'activo' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  </div>
                  <p className="text-[10px] font-black uppercase truncate">{device.alumno_asignado}</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase truncate">{device.institutoNombre}</p>
                  <div className="mt-4 pt-2 border-t border-white/5 flex justify-between items-center text-[7px] text-slate-600 font-bold uppercase">
                    <div className="flex items-center gap-1"><Clock size={10} /> {formatTime(device.ultimoAcceso)}</div>
                    <span>ID:{device.id.slice(-6)}</span>
                  </div>
                  <div className="mt-2 flex gap-1 text-[6px]">
                    {device.admin_mode_enable && <span className="bg-blue-500/20 text-blue-400 px-1 rounded">TÉCNICO</span>}
                    {device.shield_mode_enable && <span className="bg-orange-500/20 text-orange-400 px-1 rounded">BLINDADO</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* LISTA DE INSTITUCIONES */}
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-tighter mb-6">
            Instituciones <span className="text-orange-500">Activas</span>
          </h2>
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
                    <p className="text-[8px] text-slate-600 mt-1">{inst.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch 
                    checked={inst.isActive} 
                    onCheckedChange={() => toggleStatus(inst.id, inst.isActive)}
                    className="data-[state=checked]:bg-orange-600"
                  />
                  <Button variant="ghost" size="icon" className="text-slate-700 hover:text-red-500" onClick={() => {
                    if(confirm(`¿Eliminar ${inst.name}? Esta acción eliminará todos los datos de la sede.`)) {
                      deleteDoc(doc(db, 'institutions', inst.id));
                      remove(ref(rtdb, `config/instituciones/${inst.id}`));
                      remove(ref(rtdb, `stats/instituciones/${inst.id}`));
                      toast({ title: "Sede eliminada", description: `La sede ${inst.name} ha sido removida.` });
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
    </div>
  );
}
