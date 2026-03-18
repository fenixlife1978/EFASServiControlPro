'use client';

import React, { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config'; // Importamos rtdb
import { collection, doc, onSnapshot, updateDoc, setDoc, query, where, getDocs, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, update, set } from 'firebase/database'; // Métodos de RTDB
import { Power, ShieldAlert, GlobeLock, Zap, Loader2, Lock, RotateCcw, List, Wifi, UserCog, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  vpn_activa?: boolean;
  admin_mode_enable?: boolean;
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
  blacklist?: string[];
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
  const [syncing, setSyncing] = useState(false);
  const [cleaningLogs, setCleaningLogs] = useState(false);
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

  // 3. Listener para el switch técnico
  useEffect(() => {
    if (selectedDevice === 'todos') {
      setTechModeStatus(config.allowAccessGlobal || false);
      return;
    }

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

  // 4. Cambiar Modo Técnico (Firestore + RTDB Sync)
  const toggleTechMode = async (enable: boolean) => {
    try {
      if (selectedDevice === 'todos') {
        // Firestore update
        await updateDoc(doc(db, 'institutions', institutionId), { allowAccessGlobal: enable });
        
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snap = await getDocs(q);
        const promises = snap.docs.map(d => 
          updateDoc(d.ref, { admin_mode_enable: enable })
        );
        await Promise.all(promises);

        // RTDB Sync para despliegue instantáneo
        await update(ref(rtdb, `config/instituciones/${institutionId}`), {
          techModeGlobal: enable,
          lastUpdate: new Date().toISOString()
        });
        
        toast({ title: enable ? "✅ MODO TÉCNICO GLOBAL" : "🔒 BLOQUEO GLOBAL" });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          admin_mode_enable: enable,
          updatedAt: serverTimestamp() 
        });

        // RTDB Sync para el dispositivo específico si es necesario
        await update(ref(rtdb, `dispositivos/${selectedDevice}`), {
          admin_mode_enable: enable
        });
        
        toast({ title: enable ? "✅ DISPOSITIVO LIBERADO" : "🔒 DISPOSITIVO PROTEGIDO" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "❌ Error" });
    }
  };

  // 5. Sincronizar Lista Negra
  const syncBlacklist = async () => {
    if (syncing) return;
    setSyncing(true);
    toast({ title: "🔄 Sincronizando..." });

    try {
      const instRef = doc(db, 'institutions', institutionId);
      const instSnap = await getDoc(instRef);
      if (!instSnap.exists()) throw new Error("Institución no encontrada");
      
      const instData = instSnap.data();
      const blacklist = instData.blacklist || [];

      if (selectedDevice === 'todos') {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snap = await getDocs(q);
        
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, { 
            blacklistApps: blacklist,
            lastSecurityUpdate: serverTimestamp(),
            useBlacklist: instData.useBlacklist || false
          });
        }

        // Propagar reglas a RTDB para intercepción inmediata
        await update(ref(rtdb, `config/instituciones/${institutionId}/rules`), {
          blacklist: blacklist,
          updatedAt: new Date().toISOString()
        });

        toast({ title: "✅ Sincronización completada" });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          blacklistApps: blacklist,
          lastSecurityUpdate: serverTimestamp(),
          useBlacklist: instData.useBlacklist || false
        });
        toast({ title: "✅ Dispositivo actualizado" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "❌ Error", description: error.message });
    } finally {
      setSyncing(false);
    }
  };

  // 6. Limpiar logs de VPN (Lógica Original Intacta)
  const limpiarLogsVPN = async () => {
    if (cleaningLogs) return;
    setCleaningLogs(true);
    toast({ title: "🧹 Limpiando logs..." });

    try {
      if (selectedDevice === 'todos') {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        let totalEliminados = 0;
        for (const docSnapshot of snapshot.docs) {
          const logsRef = collection(db, 'dispositivos', docSnapshot.id, 'vpn_logs');
          const logsSnapshot = await getDocs(logsRef);
          if (!logsSnapshot.empty) {
            const batch = writeBatch(db);
            logsSnapshot.docs.forEach(logDoc => batch.delete(logDoc.ref));
            await batch.commit();
            totalEliminados += logsSnapshot.size;
          }
        }
        toast({ title: "✅ Logs eliminados", description: `${totalEliminados} documentos eliminados` });
      } else {
        const logsRef = collection(db, 'dispositivos', selectedDevice, 'vpn_logs');
        const logsSnapshot = await getDocs(logsRef);
        if (!logsSnapshot.empty) {
          const batch = writeBatch(db);
          logsSnapshot.docs.forEach(logDoc => batch.delete(logDoc.ref));
          await batch.commit();
          toast({ title: "✅ Logs eliminados", description: `${logsSnapshot.size} documentos eliminados` });
        }
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "❌ Error", description: error.message });
    } finally {
      setCleaningLogs(false);
    }
  };

  const toggleSetting = async (key: string, value: boolean) => {
    try {
      const instRef = doc(db, 'institutions', institutionId);
      await updateDoc(instRef, { [key]: value });

      // Sincronización RTDB para flags críticos
      await update(ref(rtdb, `config/instituciones/${institutionId}`), {
        [key]: value,
        lastUpdate: new Date().toISOString()
      });

      if (['shieldMode', 'cortarNavegacion', 'useWhitelist', 'useBlacklist'].includes(key)) {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        const updates = snapshot.docs.map(docSnap => updateDoc(docSnap.ref, { [key]: value }));
        await Promise.all(updates);
      }
      toast({ title: "✅ Configuración sincronizada" });
    } catch (error) {
      toast({ variant: "destructive", title: "❌ Error" });
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />;

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl space-y-8">
      <div className="flex items-center gap-3">
        <Zap className="text-orange-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">Controles Maestros</h2>
      </div>

      {/* SELECTOR */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic">Jurisdicción de Control:</label>
        <select 
          className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase transition-all"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
        >
          <option value="todos">⚡ TODA LA RED INSTITUCIONAL</option>
          {dispositivos.map(d => (
            <option key={d.id} value={d.id}>{d.alumno_asignado || 'SIN ASIGNAR'} - {d.id}</option>
          ))}
        </select>
      </div>

      {/* BOTONES DE ACCIÓN RÁPIDA */}
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

      {/* MANTENIMIENTO */}
      <div className="pt-6 border-t border-slate-800 space-y-4">
        <Button onClick={syncBlacklist} disabled={syncing} className="w-full h-12 bg-slate-800 hover:bg-orange-600 font-black text-[10px] uppercase gap-2">
          {syncing ? <Loader2 className="animate-spin h-4 w-4" /> : <RotateCcw size={14} />}
          Sincronizar Reglas de Red
        </Button>
        <Button onClick={limpiarLogsVPN} disabled={cleaningLogs} className="w-full h-12 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white font-black text-[9px] uppercase gap-2 border border-red-500/20">
          <Trash2 size={14} /> Limpiar Historial VPN
        </Button>
      </div>
    </div>
  );
}
