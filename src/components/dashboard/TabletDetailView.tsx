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
  Zap,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { InfractionLogModal } from '@/components/admin/InfractionLogModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TabletDetailViewProps {
  device: {
    id: string;
    alumnoNombre: string;
    serial?: string;
    status?: 'online' | 'offline' | 'alert';
    bateria?: number;
    ultimaConexion?: string;
    versionAgente?: string;
  };
}

export default function TabletDetailView({ device }: TabletDetailViewProps) {
  const [isLogOpen, setIsLogOpen] = useState(false);

  const bateriaNivel = device.bateria ?? 84;
  const isOnline = device.status !== 'offline';
  const isAlert = device.status === 'alert';

  return (
    <div className="bg-[#0f1117] rounded-[2.5rem] border border-white/5 p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-white/10 group/card">
      
      {/* HEADER: Identidad de la Unidad */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div className="relative group/icon">
            <div className={`p-6 rounded-[2.2rem] border transition-all duration-500 ${
              isOnline 
                ? 'bg-gradient-to-br from-slate-900 to-black border-orange-500/20 shadow-[0_0_30px_-10px_rgba(249,115,22,0.2)]' 
                : 'bg-slate-950 border-white/5 opacity-40'
            }`}>
              <Smartphone className={`w-9 h-9 transition-transform duration-500 group-hover/icon:scale-110 ${isOnline ? 'text-orange-500' : 'text-slate-600'}`} />
            </div>
            {isOnline && (
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-20"></span>
                <div className="relative w-4 h-4 bg-emerald-500 rounded-full border-4 border-[#0f1117]" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
                {device.alumnoNombre || 'UNIDAD SIN ASIGNAR'}
              </h3>
              {isOnline && (
                <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black px-2.5 py-0.5 uppercase italic tracking-widest">
                  LIVE
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              <code className="text-[10px] text-slate-500 font-black bg-white/5 px-2 py-0.5 rounded-md border border-white/5 uppercase tracking-tighter">
                REF: {device.id?.toUpperCase() || 'REF_NULL'}
              </code>
              <span className="flex items-center gap-1.5 text-[9px] text-orange-500/80 font-black uppercase tracking-[0.2em] italic">
                <Zap className="w-3 h-3 fill-orange-500/20" /> Shield Active
              </span>
            </div>
          </div>
        </div>

        {/* Acciones de Control */}
        <div className="flex gap-3 w-full lg:w-auto">
          <Button 
            onClick={() => setIsLogOpen(true)}
            className="flex-1 lg:flex-none bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/10 rounded-2xl font-black uppercase italic text-[10px] h-14 px-8 transition-all group/btn"
          >
            <ShieldAlert className="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform" />
            Registro de Infracciones
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="bg-slate-900 border-white/5 hover:bg-white/5 rounded-2xl h-14 w-14 transition-all">
                  <Settings2 className="w-5 h-5 text-slate-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 border-white/10 text-[9px] font-black uppercase">
                Parámetros de Red
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* MÉTRICAS DE TELEMETRÍA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        
        {/* Card: Status de Red */}
        <div className="bg-white/[0.02] border border-white/5 p-7 rounded-[2.5rem] hover:bg-white/[0.04] transition-all group/stat">
          <div className="flex items-center justify-between mb-5">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Conectividad</span>
            <Wifi className={`w-4 h-4 ${isOnline ? 'text-emerald-500' : 'text-slate-700'}`} />
          </div>
          <p className="text-2xl font-black text-white tracking-tighter uppercase italic group-hover/stat:text-orange-500 transition-colors">
            {isOnline ? 'Link Activo' : 'Desconectado'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-1 bg-emerald-500 rounded-full" />
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tight">
               AES-256 Tunelizado <span className="text-slate-800 ml-1">|</span> 12.4kb/s
            </p>
          </div>
        </div>

        {/* Card: Gestión de Energía */}
        <div className="bg-white/[0.02] border border-white/5 p-7 rounded-[2.5rem] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Suministro</span>
            <Battery className={`w-4 h-4 ${bateriaNivel < 20 ? 'text-red-500' : 'text-orange-500'} ${bateriaNivel > 95 && 'animate-pulse'}`} />
          </div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-black text-white leading-none tracking-tighter italic">{bateriaNivel}%</span>
            <span className={`text-[9px] font-black uppercase mb-1 tracking-widest ${bateriaNivel < 20 ? 'text-red-500' : 'text-slate-600'}`}>
              {bateriaNivel < 20 ? 'Crítico' : 'Estable'}
            </span>
          </div>
          <Progress value={bateriaNivel} className="h-1.5 bg-slate-900 border border-white/5 overflow-hidden [&>div]:bg-orange-500" />
        </div>

        {/* Card: Reporte Centinela */}
        <div className="bg-white/[0.02] border border-white/5 p-7 rounded-[2.5rem] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between mb-5">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Sincronización</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-black text-white tracking-tight leading-none uppercase italic truncate">
            {device.ultimaConexion || 'ONLINE NOW'}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Activity className="w-3 h-3 text-emerald-500" />
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tight">Agent v2.4 Shield Activo</p>
          </div>
        </div>
      </div>

      {/* ACCIONES DE PROTOCOLO */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/5 pt-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 shadow-inner">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white uppercase tracking-[0.25em] italic">Seguridad Centinela</span>
            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Protocolo de Monitoreo Multi-Capa</span>
          </div>
        </div>
        
        <button className="flex items-center gap-2 group/report">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-orange-500/70 group-hover/report:text-orange-500 transition-colors uppercase tracking-widest">Generar Reporte Disciplinario</span>
                <span className="text-[8px] font-bold text-slate-700 uppercase">Documento PDF oficial</span>
            </div>
            <div className="bg-orange-500/5 p-2 rounded-lg group-hover/report:bg-orange-500/10 transition-all border border-orange-500/10">
                <ChevronRight className="w-4 h-4 text-orange-500 group-hover/report:translate-x-1 transition-transform" />
            </div>
        </button>
      </div>

      <InfractionLogModal 
        isOpen={isLogOpen}
        onOpenChange={setIsLogOpen}
        deviceId={device.id}
        alumnoNombre={device.alumnoNombre}
      />
    </div>
  );
}