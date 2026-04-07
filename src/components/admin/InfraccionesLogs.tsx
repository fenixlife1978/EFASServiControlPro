'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, query, orderByChild, limitToLast, off, get, set } from 'firebase/database';
import { ShieldAlert, History, Activity, Globe, AlertTriangle, Smartphone, ShieldX, Download, Eye, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface SecurityLog {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  dispositivoNombre?: string;
}

interface DeviceInfo {
  deviceId: string;
  alumno_asignado: string;
  aulaId: string;
  seccion: string;
}

export default function InfraccionesLogs() {
  const { institutionId } = useInstitution();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [allLogs, setAllLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [validDevicesMap, setValidDevicesMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [availableDevices, setAvailableDevices] = useState<{id: string, name: string}[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [showAllDialog, setShowAllDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isDeleting, setIsDeleting] = useState(false);

  // Actualizar tiempo cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper para obtener timestamp según rango (solo 24h y 72h)
  const getTimeRangeTimestamp = (range: string): number => {
    const now = Date.now();
    switch(range) {
      case '24h': return now - (24 * 60 * 60 * 1000);
      case '72h': return now - (72 * 60 * 60 * 1000);
      default: return now - (72 * 60 * 60 * 1000);
    }
  };

  // Helper para obtener etiqueta del rango
  const getTimeRangeLabel = (range: string): string => {
    switch(range) {
      case '24h': return 'Últimas 24 horas';
      case '72h': return 'Últimas 72 horas';
      default: return 'Últimas 72 horas';
    }
  };

  // 1. Cargar dispositivos de la sede
  useEffect(() => {
    if (!institutionId) return;

    const dispositivosRef = ref(rtdb, 'dispositivos');
    
    const unsubscribe = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      const map = new Map<string, DeviceInfo>();
      const devicesList: {id: string, name: string}[] = [];
      
      if (data) {
        Object.entries(data).forEach(([deviceId, device]: [string, any]) => {
          if (device.InstitutoId === institutionId) {
            const name = device.alumno_asignado || device.nombre || 'Sin asignar';
            map.set(deviceId, {
              deviceId: deviceId,
              alumno_asignado: name,
              aulaId: device.aulaId || '—',
              seccion: device.seccion || '—'
            });
            devicesList.push({ id: deviceId, name: `${name} (${deviceId.slice(-4)})` });
          }
        });
      }
      
      devicesList.sort((a, b) => a.name.localeCompare(b.name));
      devicesList.unshift({ id: 'all', name: '📱 TODOS LOS DISPOSITIVOS' });
      
      setValidDevicesMap(map);
      setAvailableDevices(devicesList);
    });

    return () => off(dispositivosRef);
  }, [institutionId]);

  // 2. Escuchar alertas en tiempo real
  useEffect(() => {
    if (!institutionId) return;
    if (validDevicesMap.size === 0 && !loading) return;

    const alertasRef = ref(rtdb, 'alertas_seguridad');
    const recentQuery = query(alertasRef, orderByChild('timestamp'), limitToLast(500));
    
    const unsubscribe = onValue(recentQuery, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setLogs([]);
        setAllLogs([]);
        setLoading(false);
        return;
      }
      
      const alertsList: SecurityLog[] = [];
      
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        const deviceId = value.deviceId || '';
        const deviceInfo = validDevicesMap.get(deviceId);
        
        const isBlockAlert = [
          'busqueda_prohibida', 'url_prohibida', 'app_prohibida', 
          'app_restringida', 'configuracion_navegador', 'ajustes_sistema', 'modo_blindado'
        ].includes(value.tipo);
        
        if (isBlockAlert && deviceInfo) {
          alertsList.push({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: deviceId,
            dispositivoNombre: deviceInfo.alumno_asignado
          });
        }
      });
      
      const sorted = alertsList.sort((a, b) => b.timestamp - a.timestamp);
      setAllLogs(sorted);
      setLoading(false);
    });

    return () => off(alertasRef);
  }, [institutionId, validDevicesMap]);

  // 3. Filtrar logs por dispositivo y rango de tiempo
  const filteredLogs = useMemo(() => {
    let result = [...allLogs];
    
    // Filtrar por dispositivo
    if (selectedDevice !== 'all') {
      result = result.filter(log => log.deviceId === selectedDevice);
    }
    
    // Filtrar por rango de tiempo (solo 24h o 72h)
    const timeLimit = getTimeRangeTimestamp(timeRange);
    result = result.filter(log => log.timestamp >= timeLimit);
    
    return result;
  }, [allLogs, selectedDevice, timeRange]);

  // 4. Paginación
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredLogs.slice(start, end);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Resetear página cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDevice, timeRange]);

  // 5. Limpiar TODAS las infracciones de Firebase
  const limpiarTodoFirebase = async () => {
    if (!institutionId) return;
    
    const confirmed = confirm('⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará TODAS las infracciones registradas en Firebase para esta sede.\n\nEsta operación NO se puede deshacer.');
    if (!confirmed) return;
    
    setIsDeleting(true);
    toast.loading('Eliminando infracciones...');
    
    try {
      const alertasRef = ref(rtdb, 'alertas_seguridad');
      const snapshot = await get(alertasRef);
      const data = snapshot.val();
      
      if (data) {
        const keysToDelete: string[] = [];
        
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          const deviceId = value.deviceId || '';
          const deviceInfo = validDevicesMap.get(deviceId);
          
          if (deviceInfo) {
            keysToDelete.push(key);
          }
        });
        
        if (keysToDelete.length > 0) {
          const deletePromises = keysToDelete.map(key => 
            set(ref(rtdb, `alertas_seguridad/${key}`), null)
          );
          await Promise.all(deletePromises);
          toast.success(`✅ ${keysToDelete.length} infracciones eliminadas correctamente`);
        } else {
          toast.info('No hay infracciones para eliminar');
        }
      }
    } catch (error) {
      console.error('Error eliminando infracciones:', error);
      toast.error('Error al eliminar infracciones');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    if (diff < 60000) return 'ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getDescripcion = (log: SecurityLog) => {
    switch(log.tipo) {
      case 'busqueda_prohibida':
        const matchB = log.detalle.match(/palabra: (\w+)/i);
        return matchB ? `Búsqueda: "${matchB[1]}"` : log.detalle.substring(0, 50);
      case 'url_prohibida':
        const matchU = log.detalle.match(/dominio "([^"]+)"/i);
        return matchU ? `URL: ${matchU[1]}` : log.detalle.substring(0, 50);
      case 'app_prohibida':
      case 'app_restringida':
        const appMatch = log.detalle.match(/abrir: ([\w.]+)/i);
        return appMatch ? `App: ${appMatch[1].split('.').pop()}` : log.detalle.substring(0, 50);
      case 'configuracion_navegador':
        return 'Configuración navegador';
      case 'ajustes_sistema':
        return 'Ajustes del sistema';
      case 'modo_blindado':
        return 'Intento desactivar blindaje';
      default:
        return log.detalle.substring(0, 50);
    }
  };

  const getIcon = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
      case 'url_prohibida':
        return <Globe className="w-3 h-3" />;
      case 'app_prohibida':
      case 'app_restringida':
        return <Smartphone className="w-3 h-3" />;
      case 'configuracion_navegador':
      case 'ajustes_sistema':
        return <ShieldX className="w-3 h-3" />;
      default:
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return 'BÚSQUEDA';
      case 'url_prohibida':
        return 'URL';
      case 'app_prohibida':
      case 'app_restringida':
        return 'APP';
      default:
        return 'SISTEMA';
    }
  };

  const limpiarVisual = () => {
    setLogs([]);
    toast.success('Vista de alertas limpiada');
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Reporte de Infracciones - Sede ${institutionId}`, 14, 22);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 30);
      doc.text(`Período: ${getTimeRangeLabel(timeRange)}`, 14, 38);
      doc.text(`Total de registros: ${filteredLogs.length}`, 14, 46);

      const tableData = filteredLogs.map(log => [
        getTipoLabel(log.tipo),
        getDescripcion(log),
        log.dispositivoNombre || log.deviceId.substring(0, 12),
        formatFullTime(log.timestamp)
      ]);

      autoTable(doc, {
        head: [['Tipo', 'Detalle', 'Dispositivo', 'Fecha']],
        body: tableData,
        startY: 52,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [249, 115, 22] }
      });

      doc.save(`infracciones_${institutionId}_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('PDF generado correctamente');
    } catch (error) {
      toast.error('Error al generar PDF');
    }
  };

  if (!institutionId) {
    return (
      <div className="bg-[#0b0d12] rounded-[2rem] p-6 mt-4 border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
                Log de <span className="text-red-500">Infracciones</span>
              </p>
              <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest mt-1">Selecciona una sede</p>
            </div>
          </div>
        </div>
        <div className="py-12 flex flex-col items-center justify-center opacity-30 grayscale">
          <ShieldAlert className="w-8 h-8 text-slate-700 mb-3" />
          <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-[0.2em]">
            Sin sede seleccionada
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#0b0d12] rounded-[2rem] p-6 mt-4 border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <Activity className="w-3 h-3 text-red-500 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
                Log de <span className="text-red-500">Infracciones</span>
              </p>
              <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest mt-1">Cargando...</p>
            </div>
          </div>
        </div>
        <div className="py-12 flex flex-col items-center justify-center">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0d12] rounded-[2rem] p-6 mt-4 overflow-hidden border border-white/5 shadow-2xl relative">
      {/* Header con botones de acción */}
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
            <Activity className="w-3 h-3 text-red-500 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
              Log de <span className="text-red-500">Infracciones</span>
            </p>
            <p className="text-[7px] text-slate-600 font-bold uppercase tracking-widest mt-1">
              {getTimeRangeLabel(timeRange)} • {filteredLogs.length} registros
            </p>
          </div>
        </div>
        
        {/* FILTROS - CORREGIDOS: fondo blanco y texto negro */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rango de tiempo */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-slate-300 shadow-sm">
            <Filter size={12} className="text-slate-600" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-[9px] font-black text-slate-800 uppercase tracking-wider focus:outline-none cursor-pointer"
            >
              <option value="24h">ÚLTIMAS 24 HORAS</option>
              <option value="72h">ÚLTIMAS 72 HORAS</option>
            </select>
          </div>

          {/* Selector de dispositivo */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-slate-300 shadow-sm">
            <Smartphone size={12} className="text-slate-600" />
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="bg-transparent text-[9px] font-black text-slate-800 uppercase tracking-wider focus:outline-none cursor-pointer max-w-[180px]"
            >
              {availableDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* BOTONES DE ACCIÓN */}
        <div className="flex gap-2">
          <Button
            onClick={exportToPDF}
            disabled={filteredLogs.length === 0}
            variant="outline"
            className="h-7 text-[9px] border-slate-700 text-slate-400 hover:text-green-500"
          >
            <Download className="w-3 h-3 mr-1" /> PDF
          </Button>
          <Button
            onClick={() => setShowAllDialog(true)}
            variant="outline"
            className="h-7 text-[9px] border-slate-700 text-slate-400 hover:text-orange-500"
          >
            <Eye className="w-3 h-3 mr-1" /> VER LISTA
          </Button>
          <Button
            onClick={limpiarVisual}
            variant="outline"
            className="h-7 text-[9px] border-slate-700 text-slate-400 hover:text-yellow-500"
          >
            <Trash2 className="w-3 h-3 mr-1" /> LIMPIAR VISTA
          </Button>
          <Button
            onClick={limpiarTodoFirebase}
            disabled={isDeleting}
            variant="outline"
            className="h-7 text-[9px] border-red-800 text-red-500 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="w-3 h-3 mr-1" /> LIMPIAR TODO
          </Button>
        </div>
      </div>

      {/* CONTADOR Y PAGINACIÓN */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-[8px] text-slate-500">
          Mostrando {paginatedLogs.length} de {filteredLogs.length} infracciones
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={12} className="text-white" />
            </button>
            <span className="text-[8px] text-slate-400 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={12} className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Lista de alertas */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar min-h-[100px]">
        {paginatedLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center opacity-30 grayscale">
            <ShieldAlert className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-[0.2em]">
              Sin actividad fuera de protocolo
            </p>
            <p className="text-[7px] text-slate-600 mt-2">
              {selectedDevice !== 'all' ? 'Este dispositivo no tiene infracciones en el período seleccionado' : `Sede: ${institutionId} • ${getTimeRangeLabel(timeRange)}`}
            </p>
          </div>
        ) : (
          paginatedLogs.map((log) => (
            <div 
              key={log.id} 
              className="flex justify-between items-center bg-white/[0.02] p-3 rounded-2xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className="bg-slate-900 p-1.5 rounded-lg border border-white/5 group-hover:border-red-500/30 transition-colors">
                  <div className={`${log.tipo === 'app_prohibida' ? 'text-orange-500' : 'text-red-500'} group-hover:text-red-500`}>
                    {getIcon(log.tipo)}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-black text-red-500/70 uppercase tracking-tighter leading-none italic">
                      {getTipoLabel(log.tipo)}
                    </span>
                    <span className="text-[7px] text-slate-500 truncate">
                      {log.dispositivoNombre || log.deviceId.substring(0, 8)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 truncate max-w-[200px] group-hover:text-white transition-colors">
                    {getDescripcion(log)}
                  </span>
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-500 font-black tabular-nums bg-black/40 px-2 py-1 rounded-lg border border-white/5 shadow-inner">
                  {formatTime(log.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal con lista completa */}
      <Dialog open={showAllDialog} onOpenChange={setShowAllDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Lista Completa de Infracciones</DialogTitle>
            <p className="text-[10px] text-slate-500">
              Total: {filteredLogs.length} registros | Sede: {institutionId} | {getTimeRangeLabel(timeRange)}
              {selectedDevice !== 'all' && ` | Dispositivo filtrado`}
            </p>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[9px] text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Detalle</th>
                  <th className="pb-2">Dispositivo</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {getIcon(log.tipo)}
                        <span className="text-[9px] font-mono text-slate-400">
                          {getTipoLabel(log.tipo)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2">
                      <span className="text-red-400 text-[9px] break-all max-w-md block">
                        {getDescripcion(log)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="text-slate-400 text-[9px]">{log.dispositivoNombre || log.deviceId.substring(0, 12)}</span>
                    </td>
                    <td className="py-2">
                      <span className="text-slate-500 text-[9px]">{formatFullTime(log.timestamp)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800 mt-4">
            <Button
              onClick={exportToPDF}
              className="bg-red-600 hover:bg-red-700 h-8 text-[10px]"
            >
              <Download className="w-3 h-3 mr-1" /> EXPORTAR PDF
            </Button>
            <Button
              onClick={() => setShowAllDialog(false)}
              variant="outline"
              className="border-slate-700 text-slate-400"
            >
              CERRAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer Branding */}
      <div className="mt-5 pt-3 border-t border-white/5 flex justify-between items-center">
        <p className="text-[7px] font-black text-slate-700 uppercase tracking-widest italic">
          Centinela Engine v2.4
        </p>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-red-500/40 animate-pulse" />
          <div className="w-1 h-1 rounded-full bg-red-500/20" />
        </div>
      </div>

      {/* Estilos de Scrollbar Personalizados */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ef4444;
        }
      `}</style>
    </div>
  );
}