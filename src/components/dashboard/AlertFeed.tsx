'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db, rtdb } from '@/firebase/config';
import { 
  collection, query, where, onSnapshot
} from 'firebase/firestore';
import { ref, onValue, off, get, set } from 'firebase/database';
import { 
  ShieldAlert, Clock, Search, Calendar, Download, CheckCircle, Filter, Globe, Smartphone, Shield, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Alerta {
  id: string;
  descripcion?: string;
  urlIntentada?: string;
  timestamp: number;
  tipo?: string;
  deviceId?: string;
  detalle?: string;
}

interface AlertFeedProps {
  aulaId?: string;
  institutoId: string;
}

export function AlertFeed({ aulaId, institutoId }: AlertFeedProps) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [allAlertas, setAllAlertas] = useState<Alerta[]>([]);
  const [deviceInfoMap, setDeviceInfoMap] = useState<Record<string, { alumno_asignado: string; aulaId: string }>>({});
  const [availableDevices, setAvailableDevices] = useState<{id: string, name: string}[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFechaInicio, setTempFechaInicio] = useState<string>('');
  const [tempFechaFin, setTempFechaFin] = useState<string>('');
  
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedFechaInicio, setAppliedFechaInicio] = useState<string>('');
  const [appliedFechaFin, setAppliedFechaFin] = useState<string>('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [exportando, setExportando] = useState(false);

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

  // 1. Cargar dispositivos desde RTDB
  useEffect(() => {
    if (!institutoId) return;

    const dispositivosRef = ref(rtdb, 'dispositivos');
    
    const unsubscribe = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      const map: Record<string, { alumno_asignado: string; aulaId: string }> = {};
      const devicesList: {id: string, name: string}[] = [];
      
      if (data) {
        Object.entries(data).forEach(([deviceId, device]: [string, any]) => {
          if (device.InstitutoId === institutoId) {
            const name = device.alumno_asignado || device.nombre || 'Sin asignar';
            map[deviceId] = {
              alumno_asignado: name,
              aulaId: device.aulaId || ''
            };
            devicesList.push({ id: deviceId, name: `${name} (${deviceId.slice(-4)})` });
          }
        });
      }
      
      devicesList.sort((a, b) => a.name.localeCompare(b.name));
      devicesList.unshift({ id: 'all', name: '📱 TODOS LOS DISPOSITIVOS' });
      
      setDeviceInfoMap(map);
      setAvailableDevices(devicesList);
    });

    return () => off(dispositivosRef);
  }, [institutoId]);

  // 2. Escuchar alertas desde RTDB
  useEffect(() => {
    if (!institutoId) return;

    const alertasRef = ref(rtdb, 'alertas_seguridad');
    
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const deviceIds = Object.keys(deviceInfoMap);
        
        const alertsList: Alerta[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            timestamp: value.timestamp || 0,
            tipo: value.tipo || 'desconocido',
            descripcion: value.detalle || '',
            urlIntentada: value.detalle || '',
            deviceId: value.deviceId || ''
          }))
          .filter(alert => deviceIds.includes(alert.deviceId))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setAllAlertas(alertsList);
      } else {
        setAllAlertas([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error en el feed:", error);
      setLoading(false);
    });

    return () => off(alertasRef);
  }, [institutoId, deviceInfoMap]);

  // 3. Filtrar alertas por dispositivo y rango de tiempo
  const filteredByDeviceAndTime = useMemo(() => {
    let result = [...allAlertas];
    
    // Filtrar por dispositivo
    if (selectedDevice !== 'all') {
      result = result.filter(alerta => alerta.deviceId === selectedDevice);
    }
    
    // Filtrar por rango de tiempo (solo 24h o 72h)
    const timeLimit = getTimeRangeTimestamp(timeRange);
    result = result.filter(alerta => alerta.timestamp >= timeLimit);
    
    return result;
  }, [allAlertas, selectedDevice, timeRange]);

  // 4. Aplicar filtros de búsqueda y fechas
  const filteredAlertas = useMemo(() => {
    let filtradas = [...filteredByDeviceAndTime];

    if (aulaId) {
      filtradas = filtradas.filter(a => {
        const device = deviceInfoMap[a.deviceId || ''];
        return device?.aulaId === aulaId;
      });
    }

    if (appliedSearchTerm) {
      const term = appliedSearchTerm.toLowerCase();
      filtradas = filtradas.filter(a => {
        const device = deviceInfoMap[a.deviceId || ''];
        return device?.alumno_asignado?.toLowerCase().includes(term);
      });
    }

    if (appliedFechaInicio) {
      const inicio = new Date(appliedFechaInicio);
      inicio.setHours(0, 0, 0, 0);
      filtradas = filtradas.filter(a => a.timestamp >= inicio.getTime());
    }
    if (appliedFechaFin) {
      const fin = new Date(appliedFechaFin);
      fin.setHours(23, 59, 59, 999);
      filtradas = filtradas.filter(a => a.timestamp <= fin.getTime());
    }

    return filtradas;
  }, [filteredByDeviceAndTime, appliedSearchTerm, appliedFechaInicio, appliedFechaFin, aulaId, deviceInfoMap]);

  // 5. Paginación
  const totalPages = Math.ceil(filteredAlertas.length / itemsPerPage);
  const paginatedAlertas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredAlertas.slice(start, end);
  }, [filteredAlertas, currentPage, itemsPerPage]);

  // Resetear página cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDevice, timeRange, appliedSearchTerm, appliedFechaInicio, appliedFechaFin]);

  // 6. Limpiar TODAS las infracciones de Firebase
  const limpiarTodoFirebase = async () => {
    if (!institutoId) return;
    
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
          const deviceInfo = deviceInfoMap[deviceId];
          
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

  // 7. Limpiar pantalla (solo visual, no elimina datos)
  const limpiarPantalla = () => {
    toast.success("🧹 Filtros aplicados");
  };

  // 8. Restaurar todas las alertas
  const restaurarAlertas = () => {
    setSelectedDevice('all');
    setTimeRange('24h');
    setAppliedSearchTerm('');
    setTempSearchTerm('');
    setAppliedFechaInicio('');
    setTempFechaInicio('');
    setAppliedFechaFin('');
    setTempFechaFin('');
    toast.success("📋 Todos los filtros restaurados");
  };

  const handleBuscar = () => {
    setAppliedSearchTerm(tempSearchTerm);
    setAppliedFechaInicio(tempFechaInicio);
    setAppliedFechaFin(tempFechaFin);
  };

  const getTipoIcon = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return <Globe className="w-4 h-4 text-red-500" />;
      case 'url_prohibida':
        return <Globe className="w-4 h-4 text-red-500" />;
      case 'app_prohibida':
        return <Smartphone className="w-4 h-4 text-orange-500" />;
      default:
        return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return 'BÚSQUEDA PROHIBIDA';
      case 'url_prohibida':
        return 'URL PROHIBIDA';
      case 'app_prohibida':
        return 'APP PROHIBIDA';
      default:
        return 'ALERTA';
    }
  };

  const exportarPDF = () => {
    setExportando(true);
    try {
      const docPDF = new jsPDF();
      docPDF.setFillColor(15, 17, 23);
      docPDF.rect(0, 0, 210, 40, 'F');
      docPDF.setTextColor(255, 255, 255);
      docPDF.setFontSize(20);
      docPDF.text('EDUCONTROLPRO - SECURITY LOGS', 15, 20);
      docPDF.setFontSize(8);
      docPDF.setTextColor(249, 115, 22);
      docPDF.text(`REPORTE GENERADO: ${new Date().toLocaleString()}`, 15, 28);
      docPDF.text(`PERÍODO: ${getTimeRangeLabel(timeRange)}`, 15, 36);
      if (selectedDevice !== 'all') {
        const device = availableDevices.find(d => d.id === selectedDevice);
        docPDF.text(`DISPOSITIVO: ${device?.name || selectedDevice}`, 15, 44);
      }

      const tableRows = filteredAlertas.map(a => {
        const device = deviceInfoMap[a.deviceId || ''];
        return [
          (device?.alumno_asignado || 'N/A').toUpperCase(),
          new Date(a.timestamp).toLocaleString(),
          a.descripcion || a.urlIntentada || 'Bloqueo Genérico',
          getTipoLabel(a.tipo || 'desconocido')
        ];
      });

      const startY = selectedDevice !== 'all' ? 52 : 44;
      autoTable(docPDF, {
        head: [['ESTUDIANTE', 'FECHA / HORA', 'INCIDENCIA', 'TIPO']],
        body: tableRows,
        startY: startY,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [249, 115, 22] }
      });

      docPDF.save(`EDUControlPro_Alertas_${new Date().getTime()}.pdf`);
      toast.success("📄 PDF exportado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("❌ Error al exportar PDF");
    } finally {
      setExportando(false);
    }
  };

  if (loading) return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-[2rem] p-12 text-center animate-pulse">
      <ShieldAlert className="mx-auto text-slate-700 mb-4" size={32} />
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">Sincronizando Sistema...</p>
    </div>
  );

  return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-white font-black uppercase italic text-lg flex items-center gap-3">
            <ShieldAlert className="text-orange-500" size={24} />
            Alertas de <span className="text-orange-500">Seguridad</span>
          </h3>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {getTimeRangeLabel(timeRange)} • {filteredAlertas.length} registros
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Selector de dispositivo - CORREGIDO */}
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

          {/* Selector de rango de tiempo - CORREGIDO */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-slate-300 shadow-sm">
            <Clock size={12} className="text-slate-600" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-[9px] font-black text-slate-800 uppercase tracking-wider focus:outline-none cursor-pointer"
            >
              <option value="24h">ÚLTIMAS 24 HORAS</option>
              <option value="72h">ÚLTIMAS 72 HORAS</option>
            </select>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 border ${
              showFilters ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            <Filter size={14} /> {showFilters ? 'Cerrar' : 'Filtrar'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-black/40 p-5 rounded-3xl border border-slate-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input
                type="text"
                placeholder="BUSCAR ALUMNO..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white text-[10px] font-bold uppercase"
                value={tempSearchTerm}
                onChange={(e) => setTempSearchTerm(e.target.value)}
              />
            </div>
            <input
              type="date"
              className="bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-[10px] font-bold"
              value={tempFechaInicio}
              onChange={(e) => setTempFechaInicio(e.target.value)}
            />
            <input
              type="date"
              className="bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-[10px] font-bold"
              value={tempFechaFin}
              onChange={(e) => setTempFechaFin(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={exportarPDF} disabled={exportando} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-[9px] font-black">
              <Download size={14} /> PDF
            </button>
            <button onClick={limpiarPantalla} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl text-[9px] font-black">
              <Trash2 size={14} /> LIMPIAR VISTA
            </button>
            <button onClick={restaurarAlertas} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[9px] font-black">
              RESTAURAR
            </button>
            <button onClick={limpiarTodoFirebase} disabled={isDeleting} className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-xl text-[9px] font-black">
              <Trash2 size={14} /> LIMPIAR TODO
            </button>
            <button onClick={handleBuscar} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl text-[9px] font-black">
              APLICAR
            </button>
          </div>
        </div>
      )}

      {/* CONTADOR Y PAGINACIÓN */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-[8px] text-slate-500">
          Mostrando {paginatedAlertas.length} de {filteredAlertas.length} alertas
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

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {paginatedAlertas.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[2rem]">
            <CheckCircle className="mx-auto text-slate-800 mb-2" size={32} />
            <p className="text-slate-600 text-[9px] font-black uppercase">Sin incidencias</p>
            <p className="text-[7px] text-slate-700 mt-1">
              {selectedDevice !== 'all' ? 'Este dispositivo no tiene alertas en el período seleccionado' : getTimeRangeLabel(timeRange)}
            </p>
          </div>
        ) : (
          paginatedAlertas.map((alerta) => {
            const device = deviceInfoMap[alerta.deviceId || ''];
            return (
              <div key={alerta.id} className="group p-4 rounded-2xl border bg-slate-900/50 border-slate-800 hover:border-orange-500/50">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl shrink-0 bg-orange-500/10">
                    {getTipoIcon(alerta.tipo || 'desconocido')}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-white font-black text-[11px] uppercase">
                        {device?.alumno_asignado || 'Sin asignar'}
                      </h4>
                      <span className="text-[8px] font-mono text-slate-500 bg-black/50 px-2 py-1 rounded-md">
                        {new Date(alerta.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-slate-400 text-[10px] mb-2">
                      {alerta.descripcion || alerta.urlIntentada || 'INTENTO DE ACCESO'}
                    </p>
                    
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md text-[7px] font-black uppercase">
                        {getTipoLabel(alerta.tipo || 'desconocido')}
                      </span>
                      {device?.aulaId && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md text-[7px] font-black">
                          AULA: {device.aulaId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}