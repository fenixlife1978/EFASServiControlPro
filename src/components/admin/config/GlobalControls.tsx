'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, update } from 'firebase/database';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { UserCog, ShieldAlert, Smartphone, Globe } from 'lucide-react';

interface GlobalControlsProps {
  institutionId: string;
}

interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  estado?: string;
  admin_mode_enable?: boolean;
  shield_mode_enable?: boolean;
}

export function GlobalControls({ institutionId }: GlobalControlsProps) {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('todos');
  const [techMode, setTechMode] = useState(false);
  const [shieldMode, setShieldMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Cargar dispositivos de la sede desde RTDB
  useEffect(() => {
    if (!institutionId) return;

    const dispositivosRef = ref(rtdb, 'dispositivos');
    
    const unsubscribe = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      const lista: Dispositivo[] = [];
      
      if (data) {
        Object.entries(data).forEach(([id, device]: [string, any]) => {
          if (device.InstitutoId === institutionId) {
            lista.push({
              id: id,
              alumno_asignado: device.alumno_asignado || 'Sin asignar',
              estado: device.estado,
              admin_mode_enable: device.admin_mode_enable || false,
              shield_mode_enable: device.shield_mode_enable || false
            });
          }
        });
      }
      
      setDispositivos(lista);
      
      // Actualizar estados según selección
      if (selectedDevice !== 'todos') {
        const device = lista.find(d => d.id === selectedDevice);
        if (device) {
          setTechMode(device.admin_mode_enable || false);
          setShieldMode(device.shield_mode_enable || false);
        } else if (lista.length > 0) {
          setSelectedDevice('todos');
          const todosTech = lista.every(d => d.admin_mode_enable === true);
          const todosShield = lista.every(d => d.shield_mode_enable === true);
          setTechMode(todosTech && lista.length > 0);
          setShieldMode(todosShield && lista.length > 0);
        } else {
          setTechMode(false);
          setShieldMode(false);
        }
      } else {
        const todosTech = lista.every(d => d.admin_mode_enable === true);
        const todosShield = lista.every(d => d.shield_mode_enable === true);
        setTechMode(todosTech && lista.length > 0);
        setShieldMode(todosShield && lista.length > 0);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId, selectedDevice]);

  // Cambiar modo técnico
  const toggleTechMode = async (enable: boolean) => {
    if (!institutionId) return;
    
    if (dispositivos.length === 0) {
      toast({ 
        title: "Sin dispositivos", 
        description: "Vincula un dispositivo para usar esta función",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const updates: any = {};
      
      if (selectedDevice === 'todos') {
        for (const device of dispositivos) {
          updates[`dispositivos/${device.id}/admin_mode_enable`] = enable;
          updates[`status_dispositivos/${device.id}/admin_mode_enable`] = enable;
        }
        toast({
          title: enable ? "🔧 Modo Técnico GLOBAL Activado" : "🔧 Modo Técnico GLOBAL Desactivado",
          description: enable ? `Todos los ${dispositivos.length} dispositivos liberados` : "Restricciones reactivadas",
        });
      } else {
        updates[`dispositivos/${selectedDevice}/admin_mode_enable`] = enable;
        updates[`status_dispositivos/${selectedDevice}/admin_mode_enable`] = enable;
        
        const device = dispositivos.find(d => d.id === selectedDevice);
        toast({
          title: enable ? "🔧 Modo Técnico Activado" : "🔧 Modo Técnico Desactivado",
          description: enable ? `Dispositivo ${device?.alumno_asignado} liberado` : "Restricciones reactivadas",
        });
      }
      
      await update(ref(rtdb), updates);
      setTechMode(enable);
      
    } catch (error) {
      console.error("Error toggling tech mode:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo aplicar el cambio" });
    }
  };

  // Cambiar modo blindado
  const toggleShieldMode = async (enable: boolean) => {
    if (!institutionId) return;
    
    if (dispositivos.length === 0) {
      toast({ 
        title: "Sin dispositivos", 
        description: "Vincula un dispositivo para usar esta función",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const updates: any = {};
      
      if (selectedDevice === 'todos') {
        for (const device of dispositivos) {
          updates[`dispositivos/${device.id}/shield_mode_enable`] = enable;
          updates[`status_dispositivos/${device.id}/shield_mode_enable`] = enable;
        }
        toast({
          title: enable ? "🛡️ MODO BLINDADO GLOBAL Activado" : "🛡️ MODO BLINDADO GLOBAL Desactivado",
          description: enable ? `Todos los ${dispositivos.length} dispositivos bloqueados` : "Dispositivos liberados",
          variant: enable ? "destructive" : "default",
        });
      } else {
        updates[`dispositivos/${selectedDevice}/shield_mode_enable`] = enable;
        updates[`status_dispositivos/${selectedDevice}/shield_mode_enable`] = enable;
        
        const device = dispositivos.find(d => d.id === selectedDevice);
        toast({
          title: enable ? "🛡️ MODO BLINDADO Activado" : "🛡️ MODO BLINDADO Desactivado",
          description: enable ? `Dispositivo ${device?.alumno_asignado} bloqueado` : "Dispositivo liberado",
          variant: enable ? "destructive" : "default",
        });
      }
      
      await update(ref(rtdb), updates);
      setShieldMode(enable);
      
    } catch (error) {
      console.error("Error toggling shield mode:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo aplicar el cambio" });
    }
  };

  if (loading) {
    return <div className="animate-pulse h-32 bg-slate-800/20 rounded-2xl" />;
  }

  const hayDispositivos = dispositivos.length > 0;

  return (
    <div className="space-y-6">
      {/* Selector de Alcance */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-orange-500 italic tracking-widest flex items-center gap-2">
          <Globe className="w-3 h-3" /> Alcance del Comando:
        </label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          disabled={!hayDispositivos}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-[10px] font-black uppercase outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="todos">⚡ TODA LA SEDE ({dispositivos.length} EQUIPOS)</option>
          {dispositivos.map(device => (
            <option key={device.id} value={device.id}>
              📱 {device.id.slice(-8)} — {device.alumno_asignado}
            </option>
          ))}
        </select>
        {!hayDispositivos && (
          <p className="text-[8px] text-slate-500 italic pl-2">
            * Los dispositivos aparecerán aquí cuando se vinculen
          </p>
        )}
      </div>

      {/* Modo Técnico */}
      <div className="flex items-center justify-between p-5 bg-slate-900/40 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-xl">
            <UserCog className="text-orange-500 w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase italic">Anulación Técnica</p>
            <p className="text-[8px] text-slate-500">
              {hayDispositivos 
                ? (selectedDevice === 'todos' ? `Libera TODOS los dispositivos de la sede` : `Libera el dispositivo seleccionado`)
                : `Vincula un dispositivo para usar esta función`}
            </p>
          </div>
        </div>
        <Switch 
          checked={techMode}
          onCheckedChange={toggleTechMode}
          disabled={!hayDispositivos}
          className="data-[state=checked]:bg-orange-500"
        />
      </div>

      {/* Modo Blindado */}
      <div className="flex items-center justify-between p-5 bg-slate-900/40 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-xl">
            <ShieldAlert className="text-red-500 w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase italic">Modo Blindado</p>
            <p className="text-[8px] text-slate-500">
              {hayDispositivos 
                ? (selectedDevice === 'todos' ? `BLOQUEA TODOS los dispositivos de la sede` : `BLOQUEA el dispositivo seleccionado`)
                : `Vincula un dispositivo para usar esta función`}
            </p>
          </div>
        </div>
        <Switch 
          checked={shieldMode}
          onCheckedChange={toggleShieldMode}
          disabled={!hayDispositivos}
          className="data-[state=checked]:bg-red-500"
        />
      </div>

      {/* Info adicional */}
      {selectedDevice !== 'todos' && hayDispositivos && (
        <div className="text-center text-[8px] text-slate-600 border-t border-slate-800 pt-4 mt-2">
          <Smartphone className="w-3 h-3 inline mr-1" />
          Dispositivo: {dispositivos.find(d => d.id === selectedDevice)?.alumno_asignado}
        </div>
      )}
    </div>
  );
}
