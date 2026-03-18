'use client';

import { useState } from 'react';
import { 
  Smartphone, 
  Wifi, 
  Battery, 
  ShieldAlert, 
  Settings2,
  ChevronRight,
  Clock,
  Activity,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
// Importación relativa asumiendo que el modal está en la misma carpeta
import { InfractionLogModal } from '@/components/admin/InfractionLogModal';

interface TabletDetailViewProps {
  device: {
    id: string;
    alumnoNombre: string;
    serial?: string;
    status?: 'online' | 'offline' | 'alert';
    bateria?: number;
    ultimaConexion?: string;
  };
}

export default function TabletDetailView({ device }: TabletDetailViewProps) {
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Fallbacks para datos de visualización
  const bateriaNivel = device.bateria ?? 84;
  const isOnline = device.status !== 'offline';

  return (
    <div className="bg-[#0f1117] rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl transition-all duration-500">
      
      {/* HEADER: Identidad de la Unidad EDUControlPro */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className={`p-5 rounded-[2rem] border shadow-xl transition-all ${
              isOnline 
                ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' 
                : 'bg-slate-950 border-slate-900 opacity-60'
            }`}>
              <Smartphone className={`w-8 h-8 ${isOnline ? 'text-orange-500' : 'text-slate-600'}`} />
            </div>
            {isOnline && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-[#0f1117] animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                {device.alumnoNombre || 'Unidad No Asignada'}
              </h3>
              {isOnline && (
                <Badge className="bg-green-500/10 text-green-500 border-none text-[8px] font-black px-2 uppercase italic">
                  En Línea
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className="text-[9px] border-slate-800 text-slate-500 font-mono tracking-tighter">
                ID: {device.id?.toUpperCase() || 'REF_NULL'}
              </Badge>
              <span className="text-[10px] text-orange-500 font-black uppercase tracking-widest italic flex items-center gap-1">
                <Zap className="w-3 h-3" /> EDUControlPro Active
              </span>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex gap-3 w-full md:w-auto">
          <Button 
            onClick={() => setIsLogOpen(true)}
            className="flex-1 md:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase italic text-[10px] h-12 px-6 transition-all group"
          >
            <ShieldAlert className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            Ver Infracciones
          </Button>
          <Button className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-white rounded-2xl h-12 px-4 border border-slate-700 transition-colors">
            <Settings2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* GRID TÉCNICO: Estado de la Tablet */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        
        {/* Card: Conexión */}
        <div className="bg-slate-900/40 border border-slate-800/50 p-6 rounded-[2.2rem] hover:bg-slate-900/60 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Conexión</p>
            <Wifi className={`w-4 h-4 ${isOnline ? 'text-green-500' : 'text-slate-700'}`} />
          </div>
          <p className="text-xl font-black text-white tracking-tight uppercase italic group-hover:text-orange-500 transition-colors">Red Educativa</p>
          <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">
            Latencia: 18ms <span className="text-slate-700">|</span> Encriptación AES-256
          </p>
        </div>

        {/* Card: Batería */}
        <div className="bg-slate-900/40 border border-slate-800/50 p-6 rounded-[2.2rem] hover:bg-slate-900/60 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Energía</p>
            <Battery className={`w-4 h-4 ${bateriaNivel < 20 ? 'text-red-500' : 'text-orange-500'}`} />
          </div>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-3xl font-black text-white leading-none tracking-tighter">{bateriaNivel}%</span>
            <span className={`text-[10px] font-black uppercase pb-1 italic ${bateriaNivel < 20 ? 'text-red-500' : 'text-slate-500'}`}>
              {bateriaNivel < 20 ? 'Crítico' : 'Óptimo'}
            </span>
          </div>
          <Progress value={bateriaNivel} className={`h-1.5 bg-slate-800 [&>div]:transition-all ${
            bateriaNivel < 20 ? '[&>div]:bg-red-500' : '[&>div]:bg-orange-500'
          }`} />
        </div>

        {/* Card: Reporte Centinela */}
        <div className="bg-slate-900/40 border border-slate-800/50 p-6 rounded-[2.2rem] hover:bg-slate-900/60 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Estatus Agente</p>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg font-black text-white tracking-tight leading-none uppercase italic">
            {device.ultimaConexion || 'Sincronizado'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Activity className="w-3 h-3 text-green-500" />
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">EDUControlPro Shield ON</p>
          </div>
        </div>
      </div>

      {/* FOOTER: Estado del Protocolo */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/50 pt-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          </div>
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
            SISTEMA CENTINELA v2.4 <span className="text-slate-800">|</span> EDUControlPro
          </span>
        </div>
        <button className="text-[9px] font-black text-orange-500/70 hover:text-orange-500 uppercase tracking-widest flex items-center gap-1 transition-all group">
          Generar Reporte Disciplinario <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* MODAL: Historial de Infracciones */}
      <InfractionLogModal 
        isOpen={isLogOpen}
        onOpenChange={setIsLogOpen}
        deviceId={device.id}
        alumnoNombre={device.alumnoNombre}
      />
    </div>
  );
}