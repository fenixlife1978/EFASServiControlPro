'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { Power, ShieldAlert, GlobeLock, Zap, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch'; // Asegúrate de tener el componente Switch de shadcn
import { useToast } from '@/hooks/use-toast';

export function GlobalControls({ institutionId }: { institutionId: string }) {
  const [config, setConfig] = useState({
    filterActive: true,
    strictMode: false,
    maintenanceMode: false
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const docRef = doc(db, `institutions/${institutionId}/config`, 'global_settings');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as any);
      } else {
        setDoc(docRef, { filterActive: true, strictMode: false, maintenanceMode: false });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [institutionId]);

  const toggleSetting = async (key: string, value: boolean) => {
    try {
      const docRef = doc(db, `institutions/${institutionId}/config`, 'global_settings');
      await updateDoc(docRef, { [key]: value });
      toast({
        title: "Configuración Actualizada",
        description: `${key} ahora está ${value ? 'ACTIVADO' : 'DESACTIVADO'}`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />;

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-8">
        <Zap className="text-orange-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white">Controles Maestros</h2>
      </div>

      <div className="space-y-6">
        {/* Interruptor de Filtro Global */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.filterActive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Filtro de Contenido</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Activa/Desactiva toda la protección</p>
            </div>
          </div>
          <Switch 
            checked={config.filterActive} 
            onCheckedChange={(val) => toggleSetting('filterActive', val)} 
          />
        </div>

        {/* Interruptor de Modo Estricto */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.strictMode ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-500'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Modo Estricto (Whitelisting)</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Solo permite sitios autorizados</p>
            </div>
          </div>
          <Switch 
            checked={config.strictMode} 
            onCheckedChange={(val) => toggleSetting('strictMode', val)} 
          />
        </div>

        {/* Bloqueo Total / Mantenimiento */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl ${config.maintenanceMode ? 'bg-red-600/20 text-red-600 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
              <GlobeLock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase italic">Bloqueo de Navegación</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Cierra el acceso a internet totalmente</p>
            </div>
          </div>
          <Switch 
            checked={config.maintenanceMode} 
            onCheckedChange={(val) => toggleSetting('maintenanceMode', val)} 
          />
        </div>
      </div>
    </div>
  );
}