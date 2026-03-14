'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, doc, onSnapshot, updateDoc, setDoc, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { Power, ShieldAlert, GlobeLock, Zap, Loader2, Lock, EyeOff, RotateCcw, List, Wifi } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

// Definir tipos para los datos
interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  vpn_activa?: boolean;
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
    vpn_status: 'off'
  });
  const [loading, setLoading] = useState(true);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('todos');
  const [vpnDevicesStatus, setVpnDevicesStatus] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Cargar configuración de la institución
  useEffect(() => {
    const instRef = doc(db, 'institutions', institutionId);
    const unsubscribe = onSnapshot(instRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setConfig({
          blockAllBrowsing: data.blockAllBrowsing || false,
          useBlacklist: data.useBlacklist || false,
          useWhitelist: data.useWhitelist || false,
          shieldMode: data.shieldMode || false,
          cortarNavegacion: data.cortarNavegacion || false,
          pinBloqueo: data.pinBloqueo || '',
          maintenanceMode: data.maintenanceMode || false,
          vpn_enabled: data.vpn_enabled || false,
          vpn_status: data.vpn_status || 'off'
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [institutionId]);

  // Cargar dispositivos y su estado de VPN
  useEffect(() => {
    const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dispositivosData = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as Dispositivo));
      setDispositivos(dispositivosData);
      
      // Mapear estado de VPN por dispositivo
      const statusMap: Record<string, boolean> = {};
      dispositivosData.forEach(d => {
        statusMap[d.id] = d.vpn_activa || false;
      });
      setVpnDevicesStatus(statusMap);
    });
    return () => unsubscribe();
  }, [institutionId]);

  // Función para controlar VPN en dispositivos
  const toggleVpnGlobal = async (enable: boolean) => {
    try {
      const instRef = doc(db, 'institutions', institutionId);
      await updateDoc(instRef, { 
        vpn_enabled: enable,
        vpn_status: enable ? 'activating' : 'off'
      });

      // Comando para dispositivos
      if (selectedDevice === 'todos') {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        
        await Promise.all(snapshot.docs.map(docSnapshot => 
          updateDoc(docSnapshot.ref, { 
            vpn_activa: enable,
            vpn_command: enable ? 'start' : 'stop',
            vpn_command_timestamp: new Date().toISOString()
          })
        ));
        
        toast({
          title: enable ? "VPN ACTIVADA" : "VPN DESACTIVADA",
          description: `Comando enviado a ${snapshot.size} dispositivos`,
        });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          vpn_activa: enable,
          vpn_command: enable ? 'start' : 'stop',
          vpn_command_timestamp: new Date().toISOString()
        });
        
        toast({
          title: enable ? "VPN ACTIVADA" : "VPN DESACTIVADA",
          description: `Comando enviado al dispositivo seleccionado`,
        });
      }

      // Actualizar estado después de 2 segundos
      setTimeout(async () => {
        await updateDoc(instRef, { 
          vpn_status: enable ? 'on' : 'off' 
        });
      }, 2000);

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al controlar VPN" });
    }
  };

  // Función para enviar lista de sitios bloqueados actualizada
  const actualizarListaNegra = async () => {
    try {
      toast({ title: "Actualizando listas", description: "Enviando configuración a dispositivos..." });
      
      // Obtener sitios bloqueados de la subcolección
      const sitiosQuery = query(collection(db, 'institutions', institutionId, 'sitiosBloqueados'));
      const sitiosSnapshot = await getDocs(sitiosQuery);
      const sitiosBloqueados = sitiosSnapshot.docs.map(d => d.data().url).filter(Boolean);
      
      // Enviar a dispositivos
      if (selectedDevice === 'todos') {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const dispositivosSnapshot = await getDocs(q);
        
        await Promise.all(dispositivosSnapshot.docs.map(async (docSnapshot) => {
          await updateDoc(docSnapshot.ref, { 
            lista_negra_actualizada: new Date().toISOString(),
            sitios_bloqueados: sitiosBloqueados
          });
          
          // También actualizar en la subcolección del dispositivo
          const sitioRef = collection(db, 'dispositivos', docSnapshot.id, 'sitiosBloqueados');
          
          // Primero limpiar documentos existentes (opcional)
          const existingSitios = await getDocs(sitioRef);
          await Promise.all(existingSitios.docs.map(s => updateDoc(s.ref, { activo: false })));
          
          // Agregar nuevos
          for (const sitio of sitiosBloqueados) {
            const sitioId = sitio.replace(/[^a-zA-Z0-9]/g, '_');
            await setDoc(doc(sitioRef, sitioId), {
              url: sitio,
              activo: true,
              actualizado: new Date().toISOString()
            });
          }
        }));
        
        toast({ title: "Listas actualizadas", description: `Sincronizado con ${dispositivosSnapshot.size} dispositivos` });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          lista_negra_actualizada: new Date().toISOString(),
          sitios_bloqueados: sitiosBloqueados
        });
        
        const sitioRef = collection(db, 'dispositivos', selectedDevice, 'sitiosBloqueados');
        
        // Limpiar existentes
        const existingSitios = await getDocs(sitioRef);
        await Promise.all(existingSitios.docs.map(s => updateDoc(s.ref, { activo: false })));
        
        // Agregar nuevos
        for (const sitio of sitiosBloqueados) {
          const sitioId = sitio.replace(/[^a-zA-Z0-9]/g, '_');
          await setDoc(doc(sitioRef, sitioId), {
            url: sitio,
            activo: true,
            actualizado: new Date().toISOString()
          });
        }
        
        toast({ title: "Listas actualizadas", description: "Sincronizado con el dispositivo seleccionado" });
      }
      
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al actualizar listas" });
    }
  };

  const toggleSetting = async (key: string, value: boolean) => {
    try {
      const instRef = doc(db, 'institutions', institutionId);
      await updateDoc(instRef, { [key]: value });

      // Si es vpn_enabled, usar la función especial
      if (key === 'vpn_enabled') {
        await toggleVpnGlobal(value);
        return;
      }

      // Propagar a dispositivos si es necesario
      if (key === 'shieldMode' || key === 'cortarNavegacion' || key === 'useWhitelist' || key === 'useBlacklist') {
        const dispositivosRef = collection(db, 'dispositivos');
        const q = query(dispositivosRef, where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        
        const updates = snapshot.docs.map(docSnapshot => 
          updateDoc(docSnapshot.ref, { [key]: value })
        );
        await Promise.all(updates);
        
        toast({
          title: "Configuración Aplicada",
          description: `${key} actualizado en ${snapshot.size} dispositivos`,
        });
      } else {
        toast({
          title: "Configuración Actualizada",
          description: `${key} ahora está ${value ? 'ACTIVADO' : 'DESACTIVADO'}`,
        });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const actualizarPin = async () => {
    if (!pinValue.trim()) return;
    
    try {
      const instRef = doc(db, 'institutions', institutionId);
      await updateDoc(instRef, { pinBloqueo: pinValue });
      
      if (selectedDevice === 'todos') {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { pinBloqueo: pinValue })));
        toast({ title: "PIN Global Actualizado", description: `Nuevo PIN: ${pinValue}` });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { pinBloqueo: pinValue });
        toast({ title: "PIN Actualizado", description: `PIN del dispositivo: ${pinValue}` });
      }
      
      setShowPinInput(false);
      setPinValue('');
    } catch (error) {
      toast({ variant: "destructive", title: "Error al actualizar PIN" });
    }
  };

  const comandoBloqueoInmediato = async () => {
    try {
      if (selectedDevice === 'todos') {
        const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        await Promise.all(snapshot.docs.map(d => 
          updateDoc(d.ref, { 
            bloquear: true,
            bloqueo_timestamp: new Date().toISOString()
          })
        ));
        toast({ title: "Comando Enviado", description: `Bloqueo inmediato en ${snapshot.size} dispositivos` });
      } else {
        await updateDoc(doc(db, 'dispositivos', selectedDevice), { 
          bloquear: true,
          bloqueo_timestamp: new Date().toISOString()
        });
        toast({ title: "Comando Enviado", description: "Bloqueo inmediato en dispositivo seleccionado" });
      }
      
      setTimeout(async () => {
        if (selectedDevice === 'todos') {
          const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
          const snapshot = await getDocs(q);
          await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { bloquear: false })));
        } else {
          await updateDoc(doc(db, 'dispositivos', selectedDevice), { bloquear: false });
        }
      }, 2000);
    } catch (error) {
      toast({ variant: "destructive", title: "Error al enviar comando" });
    }
  };

  const rebloquearDispositivo = async (deviceId: string) => {
    try {
      await updateDoc(doc(db, 'dispositivos', deviceId), {
        admin_mode_enable: false,
        bloquear: true
      });
      toast({ title: "Dispositivo Rebloqueado", description: "El alumno no podrá acceder" });
      
      setTimeout(() => {
        updateDoc(doc(db, 'dispositivos', deviceId), { bloquear: false });
      }, 2000);
    } catch (error) {
      toast({ variant: "destructive", title: "Error al rebloquear" });
    }
  };

  // Calcular estadísticas de VPN
  const vpnActiveCount = Object.values(vpnDevicesStatus).filter(v => v).length;
  const totalDevices = dispositivos.length;

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />;

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl space-y-8">
      <div className="flex items-center gap-3">
        <Zap className="text-orange-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white">Controles Maestros</h2>
      </div>

      {/* Estado de VPN en tiempo real */}
      {totalDevices > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-black uppercase text-blue-400">VPN EN DISPOSITIVOS</span>
            </div>
            <span className="text-xs font-black text-white">{vpnActiveCount}/{totalDevices} activas</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(vpnActiveCount / totalDevices) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic">Aplicar a:</label>
        <select 
          className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase transition-all"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
        >
          <option value="todos">⚡ TODOS LOS DISPOSITIVOS</option>
          {dispositivos.map(d => (
            <option key={d.id} value={d.id}>
              {d.alumno_asignado || 'SIN ASIGNAR'} - {d.id} {vpnDevicesStatus[d.id] ? '🔵' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {/* FILTRO DE CONTENIDO (blacklist) */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.useBlacklist ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Filtro de Contenido</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Activa/Desactiva toda la protección</p>
            </div>
          </div>
          <Switch 
            checked={config.useBlacklist} 
            onCheckedChange={(val) => toggleSetting('useBlacklist', val)} 
          />
        </div>

        {/* MODO SOLO LISTA BLANCA */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.useWhitelist ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
              <List className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Navegación Solo Lista Blanca</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Solo permite sitios de la lista blanca</p>
            </div>
          </div>
          <Switch 
            checked={config.useWhitelist} 
            onCheckedChange={(val) => toggleSetting('useWhitelist', val)} 
          />
        </div>

        {/* MODO ESTRICTO (blindaje) */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.shieldMode ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-500'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Modo Estricto (Blindaje)</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Solo permite nuestra app</p>
            </div>
          </div>
          <Switch 
            checked={config.shieldMode} 
            onCheckedChange={(val) => toggleSetting('shieldMode', val)} 
          />
        </div>

        {/* BLOQUEO DE NAVEGACIÓN */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.cortarNavegacion ? 'bg-red-600/20 text-red-600 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
              <GlobeLock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Bloqueo de Navegación</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Cierra el acceso a internet totalmente</p>
            </div>
          </div>
          <Switch 
            checked={config.cortarNavegacion} 
            onCheckedChange={(val) => {
              toggleSetting('cortarNavegacion', val);
              toggleSetting('blockAllBrowsing', val);
            }} 
          />
        </div>

        {/* VPN SIEMPRE ACTIVA */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.vpn_enabled ? 'bg-blue-500/20 text-blue-500' : 'bg-slate-800 text-slate-500'}`}>
              <GlobeLock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">VPN Siempre Activa</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                {config.vpn_status === 'activating' ? '🔄 ACTIVANDO...' : 
                 config.vpn_status === 'on' ? '✅ ACTIVA' : '⭕ INACTIVA'}
              </p>
            </div>
          </div>
          <Switch 
            checked={config.vpn_enabled} 
            onCheckedChange={(val) => toggleSetting('vpn_enabled', val)} 
            disabled={config.vpn_status === 'activating'}
          />
        </div>
      </div>

      {/* Botón para actualizar lista negra */}
      <div className="border-t border-slate-800 pt-6 space-y-3">
        <h3 className="text-sm font-black text-white uppercase italic mb-4">Sincronización VPN</h3>
        
        <button
          onClick={actualizarListaNegra}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2"
        >
          <RotateCcw size={14} /> SINCRONIZAR LISTA NEGRA
        </button>
      </div>

      {/* SECCIÓN DE PIN */}
      <div className="border-t border-slate-800 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-white uppercase italic flex items-center gap-2">
            <Lock size={16} className="text-orange-500" /> PIN de Bloqueo
          </h3>
          <button 
            onClick={() => setShowPinInput(!showPinInput)}
            className="text-[10px] font-black uppercase text-orange-500 hover:text-white transition-colors"
          >
            {showPinInput ? 'Cancelar' : 'Cambiar PIN'}
          </button>
        </div>
        
        {showPinInput && (
          <div className="space-y-3">
            <input
              type="password"
              maxLength={4}
              className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-center text-2xl tracking-[0.5em]"
              placeholder="••••"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/[^0-9]/g, '').slice(0,4))}
            />
            <button
              onClick={actualizarPin}
              disabled={pinValue.length !== 4}
              className="w-full bg-orange-500 disabled:bg-slate-800 text-white font-black py-4 rounded-xl text-[10px] uppercase"
            >
              Guardar PIN
            </button>
          </div>
        )}
        
        <p className="text-[9px] text-slate-600 mt-2 italic">
          PIN actual: {config.pinBloqueo ? '••••' : 'No configurado'}
        </p>
      </div>

      {/* COMANDOS INMEDIATOS */}
      <div className="border-t border-slate-800 pt-6 space-y-3">
        <h3 className="text-sm font-black text-white uppercase italic mb-4">Comandos Inmediatos</h3>
        
        <button
          onClick={comandoBloqueoInmediato}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2"
        >
          <Lock size={14} /> BLOQUEAR AHORA
        </button>

        {selectedDevice !== 'todos' && (
          <button
            onClick={() => rebloquearDispositivo(selectedDevice)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} /> REACTIVAR BLOQUEO
          </button>
        )}
      </div>

      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-sm font-black text-white uppercase italic mb-4 flex items-center gap-2">
          <EyeOff size={16} className="text-orange-500" /> Lista Negra Global
        </h3>
        <p className="text-[10px] text-slate-500 mb-3 italic">Se gestiona desde la sección de Aulas</p>
      </div>
    </div>
  );
}