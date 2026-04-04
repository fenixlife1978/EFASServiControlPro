'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, update } from 'firebase/database';
import { 
  Smartphone, 
  Edit2, 
  User, 
  BookOpen, 
  Users, 
  Wifi, 
  WifiOff,
  History,
  Clock,
  Globe
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DispositivoCardProps {
  deviceId: string;
  deviceData: {
    alumno_asignado?: string;
    nombre?: string;
    aulaId?: string;
    seccion?: string;
    rol?: string;
    online?: boolean;
    lastSeen?: number;
    url_actual?: string;
  };
  isTeacher?: boolean;
  onUpdate?: () => void;
}

interface HistorialItem {
  id: string;
  url: string;
  timestamp: number;
  bloqueada: boolean;
}

export function DispositivoCard({ deviceId, deviceData, isTeacher = false, onUpdate }: DispositivoCardProps) {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [editando, setEditando] = useState(false);
  const [editNombre, setEditNombre] = useState(deviceData.alumno_asignado || deviceData.nombre || '');
  const [editAula, setEditAula] = useState(deviceData.aulaId || '');
  const [editSeccion, setEditSeccion] = useState(deviceData.seccion || '');
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const online = deviceData.online === true;
  const lastSeen = deviceData.lastSeen || 0;
  const nombreAlumno = deviceData.alumno_asignado || deviceData.nombre || 'Sin asignar';

  // Formatear fecha
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    if (diff < 60000) return 'ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  // Formatear hora completa
  const formatFullTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // Cargar historial web
  useEffect(() => {
    if (!mostrarHistorial && !isTeacher) return;

    const historialRef = ref(rtdb, `historial_navegacion/${deviceId}`);
    const historialQuery = onValue(historialRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const items: HistorialItem[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            url: value.url || '',
            timestamp: value.timestamp || 0,
            bloqueada: value.bloqueada || false
          }))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 20);
        setHistorial(items);
      } else {
        setHistorial([]);
      }
      setCargandoHistorial(false);
    });

    return () => historialQuery();
  }, [deviceId, mostrarHistorial, isTeacher]);

  // Guardar edición
  const guardarEdicion = async () => {
    try {
      const updates: any = {};
      if (editNombre) updates.alumno_asignado = editNombre;
      if (editAula) updates.aulaId = editAula;
      if (editSeccion) updates.seccion = editSeccion;
      
      await update(ref(rtdb, `dispositivos/${deviceId}`), updates);
      toast.success('Datos actualizados correctamente');
      setEditando(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error actualizando dispositivo:', error);
      toast.error('Error al actualizar');
    }
  };

  return (
    <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden hover:border-orange-500/40 transition-all">
      {/* Header con estado */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${online ? 'bg-green-500/10' : 'bg-slate-800'}`}>
            <Smartphone className={`w-5 h-5 ${online ? 'text-green-500' : 'text-slate-500'}`} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm truncate max-w-[150px]">{nombreAlumno}</h3>
            <p className="text-[9px] font-mono text-slate-500">{deviceId.slice(0, 12)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {online ? (
            <Badge className="bg-green-500/20 text-green-400 text-[9px] border-green-500/30">
              <Wifi className="w-2.5 h-2.5 mr-1" />
              ONLINE
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500 text-[9px]">
              <WifiOff className="w-2.5 h-2.5 mr-1" />
              OFFLINE
            </Badge>
          )}
          {!isTeacher && (
            <button
              onClick={() => setEditando(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Información del dispositivo */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <User className="w-3 h-3" />
          <span className="truncate">{nombreAlumno}</span>
        </div>
        {(deviceData.aulaId || deviceData.seccion) && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BookOpen className="w-3 h-3" />
            <span>Aula {deviceData.aulaId || '—'} / Sección {deviceData.seccion || '—'}</span>
          </div>
        )}
        {deviceData.url_actual && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500 truncate">
            <Globe className="w-3 h-3" />
            <span className="truncate">{deviceData.url_actual}</span>
          </div>
        )}
        {lastSeen > 0 && (
          <div className="flex items-center gap-2 text-[9px] text-slate-600">
            <Clock className="w-3 h-3" />
            <span>Último heartbeat: {formatDate(lastSeen)}</span>
          </div>
        )}
      </div>

      {/* Botón historial (solo para profesores) */}
      {isTeacher && (
        <div className="px-4 pb-4">
          <Button
            onClick={() => setMostrarHistorial(!mostrarHistorial)}
            variant="outline"
            className="w-full border-slate-800 text-slate-400 hover:text-orange-500 hover:border-orange-500/30 text-[10px] h-8"
          >
            <History className="w-3 h-3 mr-2" />
            {mostrarHistorial ? 'OCULTAR HISTORIAL' : 'VER HISTORIAL WEB'}
          </Button>
        </div>
      )}

      {/* Historial web */}
      {mostrarHistorial && (
        <div className="border-t border-slate-800 bg-slate-950/50">
          <div className="p-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">
              Últimas 20 URLs visitadas
            </p>
            {cargandoHistorial ? (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : historial.length === 0 ? (
              <p className="text-[10px] text-slate-600 text-center py-4">Sin historial registrado</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {historial.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-[9px]">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Globe className={`w-2.5 h-2.5 ${item.bloqueada ? 'text-red-500' : 'text-green-500'}`} />
                      <span className={`truncate ${item.bloqueada ? 'text-red-400' : 'text-slate-400'}`}>
                        {item.url}
                      </span>
                    </div>
                    <span className="text-slate-600 shrink-0">{formatFullTime(item.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de edición */}
      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Editar dispositivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase">Nombre del alumno</label>
              <Input
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase">Aula</label>
              <Input
                value={editAula}
                onChange={(e) => setEditAula(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                placeholder="Ej: 5TO"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase">Sección</label>
              <Input
                value={editSeccion}
                onChange={(e) => setEditSeccion(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                placeholder="Ej: A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(false)} className="text-slate-400">
              Cancelar
            </Button>
            <Button onClick={guardarEdicion} className="bg-orange-500 hover:bg-orange-600">
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
