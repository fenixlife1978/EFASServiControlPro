'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, doc, onSnapshot, updateDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { Power, ShieldAlert, GlobeLock, Zap, Loader2, Lock, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export function GlobalControls({ institutionId }: { institutionId: string }) {
  const [config, setConfig] = useState({
    blockAllBrowsing: false,
    useBlacklist: false,
    shieldMode: false,
    cortarNavegacion: false,
    pinBloqueo: '',
    maintenanceMode: false // para compatibilidad
  });
  const [loading, setLoading] = useState(true);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('todos');
  const { toast } = useToast();

  // Cargar configuración de la institución (desde el documento principal)
  useEffect(() => {
    const instRef = doc(db, 'institutions', institutionId);
    const unsubscribe = onSnapshot(instRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setConfig({
          blockAllBrowsing: data.blockAllBrowsing || false,
          useBlacklist: data.useBlacklist || false,
          shieldMode: data.shieldMode || false,
          cortarNavegacion: data.cortarNavegacion || false,
          pinBloqueo: data.pinBloqueo || '',
          maintenanceMode: data.maintenanceMode || false
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [institutionId]);

  // Cargar dispositivos de esta institución para comandos individuales
  useEffect(() => {
    const q = query(collection(db, 'dispositivos'), where('InstitutoId', '==', institutionId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDispositivos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [institutionId]);

  const toggleSetting = async (key: string, value: boolean) => {
    try {
      // Actualizar el documento de la institución
      const instRef = doc(db, 'institutions', institutionId);
      await updateDoc(instRef, { [key]: value });
      
      // Si es un modo que afecta a todos los dispositivos, propagar a cada uno
      if (key === 'shieldMode' || key === 'cortarNavegacion') {
        const dispositivosRef = collection(db, 'dispositivos');
        const q = query(dispositivosRef, where('InstitutoId', '==', institutionId));
        const snapshot = await getDocs(q);
        
        const updates = snapshot.docs.map(doc => 
          updateDoc(doc.ref, { [key]: value })
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
      
      // También actualizar en dispositivos seleccionados
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
      
      // Resetear el comando después de 2 segundos
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

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />;

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl space-y-8">
      <div className="flex items-center gap-3">
        <Zap className="text-orange-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white">Controles Maestros</h2>
      </div>

      {/* Selector de dispositivo */}
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
              {d.alumno_asignado || 'SIN ASIGNAR'} - {d.id}
            </option>
          ))}
        </select>
      </div>

      {/* Switches existentes pero con nombres correctos */}
      <div className="space-y-6">
        {/* FILTRO DE CONTENIDO -> useBlacklist */}
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

        {/* MODO ESTRICTO -> shieldMode */}
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

        {/* BLOQUEO DE NAVEGACIÓN -> cortarNavegacion / blockAllBrowsing */}
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
              toggleSetting('blockAllBrowsing', val); // Mantener sincronizados
            }} 
          />
        </div>
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

        {/* Botones individuales por dispositivo */}
        {selectedDevice !== 'todos' && (
          <button
            onClick={() => rebloquearDispositivo(selectedDevice)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-xl text-[10px] uppercase flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} /> REACTIVAR BLOQUEO
          </button>
        )}
      </div>

      {/* LISTA NEGRA - versión simplificada, luego podemos profundizar */}
      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-sm font-black text-white uppercase italic mb-4 flex items-center gap-2">
          <EyeOff size={16} className="text-orange-500" /> Lista Negra Global
        </h3>
        <p className="text-[10px] text-slate-500 mb-3 italic">Se gestiona desde la sección de Aulas</p>
      </div>
    </div>
  );
}