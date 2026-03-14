'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, doc, onSnapshot, updateDoc, setDoc, query, where, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
import { Power, ShieldAlert, GlobeLock, Zap, Loader2, Lock, RotateCcw, List, Wifi, UserCog } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  vpn_activa?: boolean;
  admin_mode_enable?: boolean; // Campo clave
  [key: string]: any;
}

interface InstitucionConfig {
  blockAllBrowsing: boolean;
  useBlacklist: boolean;
  useWhitelist: boolean;
  shieldMode: boolean;
  cortarNavegacion: boolean;
  pinBloqueo: string;
  maintenanceMode: boolean;
  vpn_enabled: boolean;
  vpn_status: string;
  allowAccessGlobal?: boolean;
}

export function GlobalControls({ institutionId }: { institutionId: string }) {
  const [config, setConfig] = useState<InstitucionConfig>({
    blockAllBrowsing: false,
    useBlacklist: false,
    useWhitelist: false,
    shieldMode: false,
    cortarNavegacion: false,
    pinBloqueo: '',
    maintenanceMode: false,
    vpn_enabled: false,
    vpn_status: 'off',
    allowAccessGlobal: false
  });
  const [loading, setLoading] = useState(true);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('todos');
  const [techModeStatus, setTechModeStatus] = useState<boolean>(false);
  const { toast } = useToast();

  // 1. Cargar Configuración de la Institución
  useEffect(() => {
    const instRef = doc(db, 'institutions', institutionId);
    const unsubscribe = onSnapshot(instRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setConfig(prev => ({ ...prev, ...data }));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [institutionId]);

  // 2. Cargar Lista de Dispositivos
  useEffect(() => {
    const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dispositivosData = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as Dispositivo));
      setDispositivos(dispositivosData);
    });
    return () => unsubscribe();
  }, [institutionId]);

  // 3. Listener para el switch técnico (CORREGIDO PARA LA APK)
  useEffect(() => {
    if (selectedDevice === 'todos') {
      setTechModeStatus(config.allowAccessGlobal || false);
      return;
    }

    // ANTES: Buscaba en 'devices/settings/remote'
    // AHORA: Busca en 'dispositivos/{id}' campo 'admin_mode_enable'
    const devRef = doc(db, 'dispositivos', selectedDevice);
    const unsub = onSnapshot(devRef, (snap) => {
      if (snap.exists()) {
        setTechModeStatus(snap.data().admin_mode_enable || false);
      } else {
        setTechModeStatus(false);
      }
    });
    return () => unsub();
  }, [selectedDevice, config.allowAccessGlobal]);

  // 4. Cambiar Modo Técnico (CORREGIDO PARA LA APK)
  const toggleTechMode = async (enable: boolean) => {
    try {
      if (selectedDevice === 'todos') {
        await updateDoc(doc(db, 'institutions', institutionId), { allowAccessGlobal: enable });
        
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snap = await getDocs(q);
        const promises = snap.docs.map(d => 
          updateDoc(d.ref, { admin_mode_enable: enable })
        );
        await Promise.all(promises);
        
        toast({ title: enable ? "MODO TÉCNICO GLOBAL" : "BLOQUEO GLOBAL", description: "Toda la red actualizada." });
      } else {
        // ACTUALIZACIÓN DIRECTA PARA QUE EL MONITOR SERVICE LO VEA
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          admin_mode_enable: enable,
          updatedAt: serverTimestamp() 
        });
        
        toast({ title: "CONTROL REMOTO", description: `Dispositivo ${enable ? 'desbloqueado' : 'protegido'}.` });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al cambiar modo técnico" });
    }
  };

  const toggleSetting = async (key: string, value: boolean) => {
    try {
      const instRef = doc(db, 'institutions', institutionId);
      await updateDoc(instRef, { [key]: value });

      if (['shieldMode', 'cortarNavegacion', 'useWhitelist', 'useBlacklist'].includes(key)) {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        const updates = snapshot.docs.map(docSnap => updateDoc(docSnap.ref, { [key]: value }));
        await Promise.all(updates);
        toast({ title: "Configuración Sincronizada", description: "Propagado a dispositivos." });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const syncBlacklist = async () => {
    try {
      toast({ title: "Sincronizando...", description: "Actualizando reglas en la red." });
      const instRef = doc(db, 'institutions', institutionId);
      const instSnap = await getDoc(instRef);
      const blacklist = instSnap.data()?.blacklist || [];

      const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
      const snap = await getDocs(q);
      const promises = snap.docs.map(d => updateDoc(d.ref, { 
        blacklistApps: blacklist, // Asegurar que el campo coincida con la APK
        lastSecurityUpdate: serverTimestamp() 
      }));
      await Promise.all(promises);
      toast({ title: "Éxito", description: "Reglas actualizadas." });
    } catch (e) { console.error(e); }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />;

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl space-y-8">
      <div className="flex items-center gap-3">
        <Zap className="text-orange-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white">Controles Maestros</h2>
      </div>

      {/* SELECTOR DE DISPOSITIVO */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic">Jurisdicción de Control:</label>
        <select 
          className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase transition-all"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
        >
          <option value="todos">⚡ TODA LA RED INSTITUCIONAL</option>
          {dispositivos.map(d => (
            <option key={d.id} value={d.id}>
              {d.alumno_asignado || 'SIN ASIGNAR'} - {d.id}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {/* MODO TÉCNICO */}
        <div className="flex items-center justify-between p-5 bg-orange-500/5 rounded-2xl border border-orange-500/20">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${techModeStatus ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Acceso Técnico</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase">Anula restricciones temporalmente</p>
            </div>
          </div>
          <Switch checked={techModeStatus} onCheckedChange={toggleTechMode} />
        </div>

        {/* FILTRO CENTINELA */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.useBlacklist ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Filtro Centinela</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase">Bloqueo de sitios y búsquedas</p>
            </div>
          </div>
          <Switch checked={config.useBlacklist} onCheckedChange={(val) => toggleSetting('useBlacklist', val)} />
        </div>

        {/* MODO BLINDADO */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.shieldMode ? 'bg-blue-500/20 text-blue-500' : 'bg-slate-800 text-slate-500'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Modo Blindado</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase">Restricción extrema de aplicaciones</p>
            </div>
          </div>
          <Switch checked={config.shieldMode} onCheckedChange={(val) => toggleSetting('shieldMode', val)} />
        </div>
      </div>

      <div className="border-t border-slate-800 pt-6">
        <button onClick={syncBlacklist} className="w-full bg-slate-800 hover:bg-orange-500 text-slate-400 hover:text-white font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 transition-all">
          <RotateCcw size={14} /> Sincronizar Reglas de Red
        </button>
      </div>
    </div>
  );
}

