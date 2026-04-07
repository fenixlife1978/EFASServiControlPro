'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db, rtdb } from '@/firebase/config';
import { 
  collection, query, where, onSnapshot
} from 'firebase/firestore';
import { ref, onValue, off, get, set } from 'firebase/database';
import { 
  ShieldAlert, Clock, Search, Calendar, Download, CheckCircle, Filter, Globe, Smartphone, Shield, Trash2, ChevronLeft, ChevronRight, Eye, X
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

interface AlertaAgrupada {
  deviceId: string;
  alumnoNombre: string;
  aulaId?: string;
  primeraAlerta: Alerta;
  totalAlertas: number;
  alertas: Alerta[];
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
  const [itemsPerPage] = useState(10);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFechaInicio, setTempFechaInicio] = useState<string>('');
  const [tempFechaFin, setTempFechaFin] = useState<string>('');
  
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedFechaInicio, setAppliedFechaInicio] = useState<string>('');
  const [appliedFechaFin, setAppliedFechaFin] = useState<string>('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [exportando, setExportando] = useState(false);
  
  // Estado para el modal de alertas por alumno
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAlumno, setSelectedAlumno] = useState<AlertaAgrupada | null>(null);

  // Helper para obtener timestamp según rango
  const getTimeRangeTimestamp = (range: string): number => {
    const now = Date.now();
    switch(range) {
      case '24h': return now - (24 * 60 * 60 * 1000);
      case '72h': return now - (72 * 60 * 60 * 1000);
      default: return now - (72 * 60 * 60 * 1000);
    }
  };

  const getTimeRangeLabel = (range: string): string => {
    switch(range) {
      case '24h': return 'Últimas 24 horas';
      case '72h': return 'Últimas 72 horas';
      default: return 'Últimas 72 horas';
    }
  };

  // Obtener inicio del día (0:00) para agrupar por día calendario
  const getStartOfDay = (timestamp: number): number => {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
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
    
    if (selectedDevice !== 'all') {
      result = result.filter(alerta => alerta.deviceId === selectedDevice);
    }
    
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

  // 5. AGRUPAR ALERTAS POR ALUMNO (solo primera alerta del día + contador)
  const alertasAgrupadas = useMemo(() => {
    const gruposPorAlumno: Record<string, AlertaAgrupada> = {};
    
    filteredAlertas.forEach(alerta => {
      const deviceId = alerta.deviceId || '';
      const deviceInfo = deviceInfoMap[deviceId];
      const alumnoNombre = deviceInfo?.alumno_asignado || 'Sin asignar';
      
      if (!gruposPorAlumno[deviceId]) {
        gruposPorAlumno[deviceId] = {
          deviceId,
          alumnoNombre,
          aulaId: deviceInfo?.aulaId,
          primeraAlerta: alerta,
          totalAlertas: 0,
          alertas: []
        };
      }
      
      gruposPorAlumno[deviceId].totalAlertas++;
      gruposPorAlumno[deviceId].alertas.push(alerta);
      
      // Actualizar primera alerta si esta es más reciente
      if (alerta.timestamp > gruposPorAlumno[deviceId].primeraAlerta.timestamp) {
        gruposPorAlumno[deviceId].primeraAlerta = alerta;
      }
    });
    
    // Ordenar por timestamp de primera alerta (más reciente primero)
    return Object.values(gruposPorAlumno).sort((a, b) => 
      b.primeraAlerta.timestamp - a.primeraAlerta.timestamp
    );
  }, [filteredAlertas, deviceInfoMap]);

  // 6. Paginación
  const totalPages = Math.ceil(alertasAgrupadas.length / itemsPerPage);
  const paginatedAlertas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return alertasAgrupadas.slice(start, end);
  }, [alertasAgrupadas, currentPage, itemsPerPage]);

  // Resetear página cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDevice, timeRange, appliedSearchTerm, appliedFechaInicio, appliedFechaFin]);

  // 7. LIMPIAR VISTA (solo local, no elimina Firebase)
  const limpiarVista = () => {
    setSelectedDevice('all');
    setTimeRange('24h');
    setAppliedSearchTerm('');
    setTempSearchTerm('');
    setAppliedFechaInicio('');
    setTempFechaInicio('');
    setAppliedFechaFin('');
    setTempFechaFin('');
    setCurrentPage(1);
    toast.success("🧹 Vista limpiada (los datos siguen en Firebase)");
  };

  // 8. Restaurar filtros
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

  // Abrir modal con todas las alertas del alumno
  const handleAlumnoClick = (alumno: AlertaAgrupada) => {
    setSelectedAlumno(alumno);
    setModalOpen(true);
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

  const getTipoColor = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
      case 'url_prohibida':
        return 'bg-red-500/10 text-red-500';
      case 'app_prohibida':
        return 'bg-orange-500/10 text-orange-500';
      default:
        return 'bg-slate-500/10 text-slate-500';
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

      const tableRows = alertasAgrupadas.map(a => [
        a.alumnoNombre.toUpperCase(),
        new Date(a.primeraAlerta.timestamp).toLocaleString(),
        `${a.totalAlertas} alertas`,
        a.aulaId || 'N/A'
      ]);

      const startY = selectedDevice !== 'all' ? 52 : 44;
      autoTable(docPDF, {
        head: [['ESTUDIANTE', 'ÚLTIMA ALERTA', 'TOTAL', 'AULA']],
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
    <>
      <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-white font-black uppercase italic text-lg flex items-center gap-3">
              <ShieldAlert className="text-orange-500" size={24} />
              Alertas de <span className="text-orange-500">Seguridad</span>
            </h3>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              {getTimeRangeLabel(timeRange)} • {alertasAgrupadas.length} alumnos con alertas
            </p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
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
              <button onClick={limpiarVista} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl text-[9px] font-black">
                <Trash2 size={14} /> LIMPIAR VISTA
              </button>
              <button onClick={restaurarAlertas} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[9px] font-black">
                RESTAURAR
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
            Mostrando {paginatedAlertas.length} de {alertasAgrupadas.length} alumnos con alertas
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

        {/* LISTA DE ALUMNOS CON ALERTAS (AGRUPADA) */}
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
            paginatedAlertas.map((alumno) => {
              const totalAlertas = alumno.totalAlertas;
              const nivelAlerta = totalAlertas >= 5 ? 'high' : totalAlertas >= 2 ? 'medium' : 'low';
              const alertaColor = nivelAlerta === 'high' ? 'text-red-500' : nivelAlerta === 'medium' ? 'text-orange-500' : 'text-yellow-500';
              const bgColor = nivelAlerta === 'high' ? 'bg-red-500/10' : nivelAlerta === 'medium' ? 'bg-orange-500/10' : 'bg-yellow-500/10';
              
              return (
                <div 
                  key={alumno.deviceId} 
                  onClick={() => handleAlumnoClick(alumno)}
                  className="group p-4 rounded-2xl border bg-slate-900/50 border-slate-800 hover:border-orange-500/50 cursor-pointer transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl shrink-0 ${bgColor}`}>
                      {getTipoIcon(alumno.primeraAlerta.tipo || 'desconocido')}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-black text-[11px] uppercase">
                            {alumno.alumnoNombre}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black ${bgColor} ${alertaColor}`}>
                            {totalAlertas} {totalAlertas === 1 ? 'ALERTA' : 'ALERTAS'}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-slate-500 bg-black/50 px-2 py-1 rounded-md">
                          {new Date(alumno.primeraAlerta.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-slate-400 text-[10px] mb-2 line-clamp-1">
                        {alumno.primeraAlerta.descripcion || alumno.primeraAlerta.urlIntentada || 'INTENTO DE ACCESO'}
                      </p>
                      
                      <div className="flex gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase ${getTipoColor(alumno.primeraAlerta.tipo || 'desconocido')}`}>
                          {getTipoLabel(alumno.primeraAlerta.tipo || 'desconocido')}
                        </span>
                        {alumno.aulaId && (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md text-[7px] font-black">
                            AULA: {alumno.aulaId}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-slate-500/10 text-slate-400 rounded-md text-[7px] font-black flex items-center gap-1">
                          <Eye size={10} /> Ver todas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL PARA VER TODAS LAS ALERTAS DEL ALUMNO */}
      {modalOpen && selectedAlumno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-orange-500/30 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Header del modal */}
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <div>
                <h3 className="text-white font-black text-xl uppercase flex items-center gap-2">
                  <ShieldAlert className="text-orange-500" size={20} />
                  {selectedAlumno.alumnoNombre}
                </h3>
                <p className="text-[9px] text-slate-500 mt-1">
                  {selectedAlumno.totalAlertas} alertas en total • Aula: {selectedAlumno.aulaId || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            {/* Lista de alertas del alumno */}
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {selectedAlumno.alertas
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((alerta, idx) => (
                  <div key={alerta.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/10 shrink-0">
                        {getTipoIcon(alerta.tipo || 'desconocido')}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${getTipoColor(alerta.tipo || 'desconocido')}`}>
                            {getTipoLabel(alerta.tipo || 'desconocido')}
                          </span>
                          <span className="text-[8px] text-slate-500 font-mono">
                            {new Date(alerta.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          {alerta.descripcion || alerta.urlIntentada || 'Intento de acceso bloqueado'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Footer del modal */}
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}