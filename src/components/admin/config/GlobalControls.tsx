'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, doc, onSnapshot, updateDoc, setDoc, query, where, getDocs, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Power, ShieldAlert, GlobeLock, Zap, Loader2, Lock, RotateCcw, List, Wifi, UserCog, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

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

  // 4. Cambiar Modo Técnico
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
        
        toast({ 
          title: enable ? "✅ MODO TÉCNICO GLOBAL" : "🔒 BLOQUEO GLOBAL", 
          description: enable 
            ? "Acceso liberado en toda la red" 
            : "Protección restablecida en toda la red"
        });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          admin_mode_enable: enable,
          updatedAt: serverTimestamp() 
        });
        
        toast({ 
          title: enable ? "✅ DISPOSITIVO LIBERADO" : "🔒 DISPOSITIVO PROTEGIDO",
          description: `El dispositivo ${enable ? 'tiene acceso total' : 'está bloqueado'}`
        });
      }
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "❌ Error", 
        description: "No se pudo cambiar el modo técnico" 
      });
    }
  };

  // 5. Sincronizar Lista Negra
  const syncBlacklist = async () => {
    if (syncing) return;
    
    setSyncing(true);
    const toastId = toast({
      title: "🔄 Sincronizando...",
      description: "Obteniendo reglas desde la institución",
    });

    try {
      // Obtener blacklist de la institución
      const instRef = doc(db, 'institutions', institutionId);
      const instSnap = await getDoc(instRef);
      
      if (!instSnap.exists()) {
        throw new Error("Institución no encontrada");
      }
      
      const instData = instSnap.data();
      const blacklist = instData.blacklist || [];
      
      toast({
        title: "📋 Reglas obtenidas",
        description: `${blacklist.length} sitios en lista negra`,
      });

      // Aplicar a dispositivos
      if (selectedDevice === 'todos') {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          toast({
            title: "⚠️ Sin dispositivos",
            description: "No hay dispositivos vinculados",
          });
          setSyncing(false);
          return;
        }

        let updated = 0;
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, { 
            blacklistApps: blacklist,
            lastSecurityUpdate: serverTimestamp(),
            useBlacklist: instData.useBlacklist || false
          });
          updated++;
        }
        
        toast({
          title: "✅ Sincronización completada",
          description: `${updated} dispositivos actualizados con ${blacklist.length} reglas`,
        });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          blacklistApps: blacklist,
          lastSecurityUpdate: serverTimestamp(),
          useBlacklist: instData.useBlacklist || false
        });
        
        toast({
          title: "✅ Dispositivo actualizado",
          description: `${blacklist.length} reglas aplicadas al dispositivo`,
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "❌ Error de sincronización",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setSyncing(false);
    }
  };

  // 6. Limpiar logs de VPN - CON CONSOLE.LOG PARA DEBUG
  const limpiarLogsVPN = async () => {
    if (cleaningLogs) {
      console.log("🧹 Ya hay una limpieza en curso, ignorando...");
      return;
    }
    
    console.log("🧹 ===== INICIANDO LIMPIEZA DE LOGS =====");
    console.log("🧹 Dispositivo seleccionado:", selectedDevice);
    setCleaningLogs(true);
    
    toast({
      title: "🧹 Limpiando logs...",
      description: "Eliminando documentos de vpn_logs",
    });

    try {
      if (selectedDevice === 'todos') {
        console.log("🧹 Modo: TODOS LOS DISPOSITIVOS");
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        console.log("🧹 Dispositivos encontrados:", snapshot.size);
        
        if (snapshot.empty) {
          console.log("🧹 No hay dispositivos vinculados");
          toast({
            title: "⚠️ Sin dispositivos",
            description: "No hay dispositivos vinculados",
          });
          return;
        }

        let totalEliminados = 0;
        for (const docSnapshot of snapshot.docs) {
          console.log(`🧹 Procesando dispositivo: ${docSnapshot.id}`);
          const logsRef = collection(db, 'dispositivos', docSnapshot.id, 'vpn_logs');
          const logsSnapshot = await getDocs(logsRef);
          console.log(`🧹 Logs encontrados en ${docSnapshot.id}:`, logsSnapshot.size);
          
          if (!logsSnapshot.empty) {
            const batch = writeBatch(db);
            logsSnapshot.docs.forEach(logDoc => {
              batch.delete(logDoc.ref);
            });
            await batch.commit();
            totalEliminados += logsSnapshot.size;
            console.log(`🧹 Eliminados ${logsSnapshot.size} logs de ${docSnapshot.id}`);
          }
        }
        
        console.log(`🧹 TOTAL ELIMINADOS: ${totalEliminados} documentos`);
        toast({
          title: "✅ Logs eliminados",
          description: `${totalEliminados} documentos eliminados de ${snapshot.size} dispositivos`,
        });
      } else {
        console.log(`🧹 Modo: DISPOSITIVO ÚNICO - ${selectedDevice}`);
        const logsRef = collection(db, 'dispositivos', selectedDevice, 'vpn_logs');
        const logsSnapshot = await getDocs(logsRef);
        console.log(`🧹 Logs encontrados:`, logsSnapshot.size);
        
        if (logsSnapshot.empty) {
          console.log("🧹 No hay logs para eliminar");
          toast({
            title: "ℹ️ Sin logs",
            description: "El dispositivo no tiene logs de VPN",
          });
        } else {
          const batch = writeBatch(db);
          logsSnapshot.docs.forEach(logDoc => {
            batch.delete(logDoc.ref);
          });
          await batch.commit();
          console.log(`🧹 Eliminados ${logsSnapshot.size} logs`);
          
          toast({
            title: "✅ Logs eliminados",
            description: `${logsSnapshot.size} documentos eliminados`,
          });
        }
      }
      console.log("🧹 ===== LIMPIEZA COMPLETADA EXITOSAMENTE =====");
    } catch (error) {
      console.error("❌ ERROR EN LIMPIEZA:", error);
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: error instanceof Error ? error.message : "No se pudieron eliminar los logs",
      });
    } finally {
      console.log("🧹 Reseteando estado cleaningLogs a false");
      setCleaningLogs(false);
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
        toast({ 
          title: "✅ Configuración sincronizada", 
          description: `Propagado a ${snapshot.size} dispositivos` 
        });
      } else {
        toast({ 
          title: "✅ Configuración actualizada", 
          description: `${key} = ${value}` 
        });
      }
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "❌ Error", 
        description: "No se pudo actualizar" 
      });
    }
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

      {/* BOTÓN DE SINCRONIZACIÓN */}
      <div className="border-t border-slate-800 pt-6 space-y-3">
        <button 
          onClick={syncBlacklist} 
          disabled={syncing}
          className={`w-full ${syncing ? 'bg-orange-500/50' : 'bg-slate-800 hover:bg-orange-500'} text-white font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 transition-all`}
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw size={14} />
          )}
          {syncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR REGLAS DE RED'}
        </button>
        
        <p className="text-[8px] text-slate-600 text-center italic">
          Última sincronización: {new Date().toLocaleTimeString()}
        </p>
      </div>

      {/* BOTÓN PARA LIMPIAR LOGS VPN */}
      <div className="border-t border-slate-800 pt-6 space-y-3">
        <h3 className="text-sm font-black text-white uppercase italic mb-4 flex items-center gap-2">
          <Trash2 size={16} className="text-red-500" /> Mantenimiento
        </h3>
        
        <button
          onClick={limpiarLogsVPN}
          disabled={cleaningLogs}
          className={`w-full ${cleaningLogs ? 'bg-red-500/50' : 'bg-red-600/30 hover:bg-red-600/50'} text-white font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2 border border-red-500/30 transition-all`}
        >
          {cleaningLogs ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
          {cleaningLogs ? 'LIMPIANDO...' : 'LIMPIAR LOGS VPN'}
        </button>
      </div>
    </div>
  );
}

