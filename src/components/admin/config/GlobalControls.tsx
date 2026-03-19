'use client';

import React, { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config';
import { 
  doc, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { ref, onValue, update } from 'firebase/database';
import { 
  ShieldAlert, Zap, Loader2, RotateCcw, 
  UserCog, Trash2, ChevronDown, Smartphone 
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export function GlobalControls({ institutionId }: { institutionId: string }) {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('todos');
  const [techModeStatus, setTechModeStatus] = useState<boolean>(false);
  const [cleaningLogs, setCleaningLogs] = useState(false);
  const { toast } = useToast();

  // 1. Cargar Configuración de la Sede (Firestore)
  useEffect(() => {
    if (!institutionId) return;
    const unsub = onSnapshot(doc(db, 'institutions', institutionId), (snap) => {
      if (snap.exists()) setConfig(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, [institutionId]);

  // 2. Escucha en RTDB (Origen de la verdad para tablets activas)
  useEffect(() => {
    if (!institutionId) return;
    const dbRef = ref(rtdb, 'dispositivos');
    return onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data)
          .map(([id, info]: [string, any]) => ({ id, ...info }))
          .filter(d => d.InstitutoId === institutionId);
        setDispositivos(lista);
      } else {
        setDispositivos([]);
      }
    });
  }, [institutionId]);

  // 3. Sync de estado del Switch (Visualización)
  useEffect(() => {
    if (selectedDevice === 'todos') {
      setTechModeStatus(config.allowAccessGlobal || false);
    } else {
      const dev = dispositivos.find(d => d.id === selectedDevice);
      setTechModeStatus(dev?.admin_mode_enable || false);
    }
  }, [selectedDevice, dispositivos, config.allowAccessGlobal]);

  // 4. Lógica de Control (Dual Write: RTDB + Firestore)
  const toggleTechMode = async (enable: boolean) => {
    try {
      if (selectedDevice === 'todos') {
        // Acciones Globales
        await updateDoc(doc(db, 'institutions', institutionId), { allowAccessGlobal: enable });
        await update(ref(rtdb, `config/instituciones/${institutionId}`), { 
          techModeGlobal: enable, 
          updatedAt: Date.now() 
        });
        toast({ title: "MODO TÉCNICO GLOBAL ACTUALIZADO" });
      } else {
        // --- ACCIÓN INDIVIDUAL ESTANDARIZADA ---
        
        // A. Actualizar RTDB (Respuesta inmediata de la tablet)
        await update(ref(rtdb, `dispositivos/${selectedDevice}`), { 
          admin_mode_enable: enable,
          last_command_ts: Date.now()
        });

        // B. Actualizar/Crear en Firestore (Estandarizado a deviceId)
        const firestoreRef = doc(db, 'dispositivos', selectedDevice);
        const docSnap = await getDoc(firestoreRef);

        const dataPayload = {
          deviceId: selectedDevice, // NORMALIZADO
          InstitutoId: institutionId,
          admin_mode_enable: enable,
          updatedAt: serverTimestamp(),
          syncSource: 'dashboard_master'
        };

        if (!docSnap.exists()) {
          await setDoc(firestoreRef, { ...dataPayload, createdAt: serverTimestamp() });
        } else {
          await updateDoc(firestoreRef, dataPayload);
        }

        toast({ title: `EQUIPO ${selectedDevice} ACTUALIZADO` });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error en la sincronización" });
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-orange-500" /></div>;

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[3rem] p-10 space-y-10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-orange-500/10 p-4 rounded-2xl shadow-inner">
          <Zap className="text-orange-500 w-6 h-6 fill-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter leading-none">Global Controls</h2>
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em] mt-2 italic">Sede: {institutionId}</p>
        </div>
      </div>

      {/* Selector de Dispositivos */}
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase text-orange-500 italic tracking-widest flex items-center gap-2 px-2">
          <Smartphone className="w-3 h-3" /> Alcance del Comando:
        </label>
        <div className="relative">
          <select 
            className="w-full bg-[#1c212c] border-2 border-white/5 rounded-2xl p-5 text-white font-black text-xs uppercase italic outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            <option value="todos">⚡ TODA LA SEDE ({dispositivos.length} EQUIPOS)</option>
            {dispositivos.map(d => (
              <option key={d.id} value={d.id}>📱 {d.id} — {d.alumno_asignado || 'IDENTIFICANDO...'}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Switches de Control */}
      <div className="grid grid-cols-1 gap-4">
        <ControlSwitch 
          active={techModeStatus} 
          onToggle={toggleTechMode} 
          icon={<UserCog className="w-5 h-5" />} 
          title="ANULACIÓN TÉCNICA" 
          desc="LIBERAR SEGURIDAD (SYNC: RTDB/FS)" 
          color="orange" 
        />
        <ControlSwitch 
          active={config.shieldMode} 
          onToggle={(v: boolean) => updateDoc(doc(db, 'institutions', institutionId), { shieldMode: v })} 
          icon={<ShieldAlert className="w-5 h-5" />} 
          title="MODO BLINDADO" 
          desc="RESTRICCIÓN TOTAL DE DISPOSITIVO" 
          color="blue" 
        />
      </div>

      {/* Botones de Mantenimiento */}
      <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
        <Button className="h-16 bg-white text-black hover:bg-orange-600 hover:text-white font-black text-xs uppercase italic rounded-2xl transition-all shadow-xl gap-3">
          <RotateCcw size={18} /> Sincronizar Políticas de Red
        </Button>
      </div>
    </div>
  );
}

// Subcomponente reutilizable
function ControlSwitch({ active, onToggle, icon, title, desc, color }: any) {
  const colors: any = { 
    orange: "data-[state=checked]:bg-orange-500", 
    blue: "data-[state=checked]:bg-blue-600" 
  };
  
  return (
    <div className="flex items-center justify-between p-6 bg-white/[0.01] rounded-[2.5rem] border border-white/5 hover:bg-white/[0.03] transition-all group">
      <div className="flex gap-5 items-center">
        <div className={`p-4 rounded-2xl transition-all duration-500 ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-900 text-slate-700'}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-black text-white uppercase italic tracking-tighter leading-none">{title}</p>
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-tight mt-1">{desc}</p>
        </div>
      </div>
      <Switch checked={active} onCheckedChange={onToggle} className={colors[color]} />
    </div>
  );
}
