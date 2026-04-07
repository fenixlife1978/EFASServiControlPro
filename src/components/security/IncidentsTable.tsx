'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { rtdb, db } from '@/firebase/config';
import { ref, onValue, off, update, get, set } from 'firebase/database';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  ShieldAlert, Globe, Monitor, Clock, CheckCircle, Smartphone, Shield, 
  Filter, ChevronLeft, ChevronRight, Trash2, Eye, X, Download, AlertTriangle 
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  leido?: boolean;
}

interface DeviceInfo {
  deviceId: string;
  alumno_asignado?: string;
  aulaId?: string;
}

interface AlumnoAgrupado {
  deviceId: string;
  alumnoNombre: string;
  aulaId: string;
  primeraInfraccion: SecurityAlert;
  totalInfracciones: number;
  infracciones: SecurityAlert[];
}

export function IncidentsTable({ institutionId }: { institutionId: string }) {
  const [incidents, setIncidents] = useState<SecurityAlert[]>([]);
  const [allIncidents, setAllIncidents] = useState<SecurityAlert[]>([]);
  const [deviceInfoMap, setDeviceInfoMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [availableDevices, setAvailableDevices] = useState<{id: string, name: string}[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estado para el modal de infracciones por alumno
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAlumno, setSelectedAlumno] = useState<AlumnoAgrupado | null>(null);
  const [exportando, setExportando] = useState(false);

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

  // 1. Cargar información de dispositivos
  useEffect(() => {
    if (!institutionId) return;
    
    const fetchDevices = async () => {
      try {
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await get(dispositivosRef);
        const rtdbData = snapshot.val();
        
        const map = new Map<string, DeviceInfo>();
        const devicesList: {id: string, name: string}[] = [];
        
        if (rtdbData) {
          Object.entries(rtdbData).forEach(([deviceId, device]: [string, any]) => {
            if (device.InstitutoId === institutionId) {
              const name = device.alumno_asignado || device.nombre || 'Sin asignar';
              map.set(deviceId, {
                deviceId: deviceId,
                alumno_asignado: name,
                aulaId: device.aulaId || '—'
              });
              devicesList.push({ id: deviceId, name: `${name} (${deviceId.slice(-4)})` });
            }
          });
        }
        
        devicesList.sort((a, b) => a.name.localeCompare(b.name));
        devicesList.unshift({ id: 'all', name: '📱 TODOS LOS DISPOSITIVOS' });
        
        setDeviceInfoMap(map);
        setAvailableDevices(devicesList);
      } catch (error) {
        console.error('Error cargando dispositivos:', error);
      }
    };
    
    fetchDevices();
  }, [institutionId]);

  // 2. Escuchar alertas desde RTDB
  useEffect(() => {
    if (!institutionId) return;

    const alertasRef = ref(rtdb, 'alertas_seguridad');
    
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const deviceIds = Array.from(deviceInfoMap.keys());
        
        const alertsList: SecurityAlert[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: value.deviceId || '',
            leido: value.leido || false
          }))
          .filter(alert => deviceIds.includes(alert.deviceId))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setAllIncidents(alertsList);
      } else {
        setAllIncidents([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error en el log:", error);
      setLoading(false);
    });

    return () => off(alertasRef);
  }, [institutionId, deviceInfoMap]);

  // 3. Filtrar incidentes por dispositivo y rango de tiempo
  const filteredIncidents = useMemo(() => {
    let result = [...allIncidents];
    
    if (selectedDevice !== 'all') {
      result = result.filter(inc => inc.deviceId === selectedDevice);
    }
    
    const timeLimit = getTimeRangeTimestamp(timeRange);
    result = result.filter(inc => inc.timestamp >= timeLimit);
    
    return result;
  }, [allIncidents, selectedDevice, timeRange]);

  // 4. AGRUPAR INCIDENTES POR ALUMNO
  const incidentesAgrupados = useMemo(() => {
    const gruposPorAlumno: Record<string, AlumnoAgrupado> = {};
    
    filteredIncidents.forEach(incidente => {
      const deviceId = incidente.deviceId;
      const deviceInfo = deviceInfoMap.get(deviceId);
      const alumnoNombre = deviceInfo?.alumno_asignado || 'Sin asignar';
      const aulaId = deviceInfo?.aulaId || '—';
      
      if (!gruposPorAlumno[deviceId]) {
        gruposPorAlumno[deviceId] = {
          deviceId,
          alumnoNombre,
          aulaId,
          primeraInfraccion: incidente,
          totalInfracciones: 0,
          infracciones: []
        };
      }
      
      gruposPorAlumno[deviceId].totalInfracciones++;
      gruposPorAlumno[deviceId].infracciones.push(incidente);
      
      // Actualizar primera infracción si esta es más reciente
      if (incidente.timestamp > gruposPorAlumno[deviceId].primeraInfraccion.timestamp) {
        gruposPorAlumno[deviceId].primeraInfraccion = incidente;
      }
    });
    
    // Ordenar por timestamp de primera infracción (más reciente primero)
    return Object.values(gruposPorAlumno).sort((a, b) => 
      b.primeraInfraccion.timestamp - a.primeraInfraccion.timestamp
    );
  }, [filteredIncidents, deviceInfoMap]);

  // 5. Paginación
  const totalPages = Math.ceil(incidentesAgrupados.length / itemsPerPage);
  const paginatedAlumnos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return incidentesAgrupados.slice(start, end);
  }, [incidentesAgrupados, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDevice, timeRange]);

  // 6. Limpiar TODAS las infracciones de Firebase
  const limpiarTodoFirebase = async () => {
    if (!institutionId) return;
    
    const confirmed = confirm('⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará TODAS las infracciones registradas en Firebase para esta sede.\n\nEsta operación NO se puede deshacer.');
    if (!confirmed) return;
    
    setIsDeleting(true);
    toast.loading('Eliminando todas las infracciones...');
    
    try {
      const alertasRef = ref(rtdb, 'alertas_seguridad');
      const snapshot = await get(alertasRef);
      const data = snapshot.val();
      
      if (data) {
        const keysToDelete: string[] = [];
        
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          const deviceId = value.deviceId || '';
          const deviceInfo = deviceInfoMap.get(deviceId);
          
          if (deviceInfo) {
            keysToDelete.push(key);
          }
        });
        
        if (keysToDelete.length > 0) {
          const deletePromises = keysToDelete.map(key => 
            set(ref(rtdb, `alertas_seguridad/${key}`), null)
          );
          await Promise.all(deletePromises);
          toast.success(`✅ ${keysToDelete.length} infracciones eliminadas`);
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

  // 7. Marcar alerta como leída
  const markAsResolved = async (alertId: string) => {
    try {
      const alertRef = ref(rtdb, `alertas_seguridad/${alertId}`);
      await update(alertRef, { 
        leido: true,
        leido_en: Date.now()
      });
      toast.success('Infracción marcada como revisada');
    } catch (error) {
      console.error("Error al actualizar incidencia:", error);
      toast.error('Error al marcar como revisada');
    }
  };

  // 8. Exportar infracciones de un alumno específico a PDF
  const exportarInfraccionesAlumno = async (alumno: AlumnoAgrupado) => {
    setExportando(true);
    try {
      const docPDF = new jsPDF();
      
      // Header
      docPDF.setFillColor(15, 17, 23);
      docPDF.rect(0, 0, 210, 50, 'F');
      docPDF.setTextColor(255, 255, 255);
      docPDF.setFontSize(18);
      docPDF.text('EDUCONTROLPRO - REPORTE DE INFRACCIONES', 15, 20);
      docPDF.setFontSize(10);
      docPDF.setTextColor(249, 115, 22);
      docPDF.text(`ALUMNO: ${alumno.alumnoNombre.toUpperCase()}`, 15, 32);
      docPDF.text(`AULA: ${alumno.aulaId}`, 15, 40);
      docPDF.text(`TOTAL INFRACCIONES: ${alumno.totalInfracciones}`, 15, 48);
      
      // Tabla
      const tableRows = alumno.infracciones
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(inc => [
          new Date(inc.timestamp).toLocaleString(),
          getTipoLabel(inc.tipo),
          inc.detalle || 'Acción bloqueada',
          inc.leido ? 'REVISADA' : 'PENDIENTE'
        ]);
      
      autoTable(docPDF, {
        head: [['FECHA/HORA', 'TIPO', 'DETALLE', 'ESTADO']],
        body: tableRows,
        startY: 55,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [249, 115, 22] }
      });
      
      docPDF.save(`EDUControlPro_${alumno.alumnoNombre}_infracciones.pdf`);
      toast.success(`📄 PDF de ${alumno.alumnoNombre} exportado`);
    } catch (error) {
      console.error(error);
      toast.error("❌ Error al exportar PDF");
    } finally {
      setExportando(false);
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return <Globe size={18} />;
      case 'app_prohibida':
        return <Smartphone size={18} />;
      case 'configuracion_navegador':
      case 'ajustes_sistema':
        return <Shield size={18} />;
      default:
        return <Monitor size={18} />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return 'BÚSQUEDA PROHIBIDA';
      case 'app_prohibida':
        return 'APP PROHIBIDA';
      case 'configuracion_navegador':
        return 'CONFIG. NAVEGADOR';
      case 'ajustes_sistema':
        return 'AJUSTES SISTEMA';
      default:
        return 'ALERTA';
    }
  };

  const getTipoColor = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        return 'bg-red-500/10 text-red-500';
      case 'app_prohibida':
        return 'bg-orange-500/10 text-orange-500';
      default:
        return 'bg-yellow-500/10 text-yellow-500';
    }
  };

  const formatFecha = (timestamp: number) => {
    if (!timestamp) return "---";
    return new Date(timestamp).toLocaleString();
  };

  const getDeviceInfo = (deviceId: string) => {
    return deviceInfoMap.get(deviceId) || {
      deviceId: deviceId,
      alumno_asignado: 'Sin asignar',
      aulaId: '—'
    };
  };

  const totalPendientes = filteredIncidents.filter(i => !i.leido).length;
  const totalAlumnosConIncidencias = incidentesAgrupados.length;

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-[10px] font-black text-slate-500 uppercase italic">Cargando registros de seguridad...</p>
    </div>
  );

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="bg-[#0a0c10] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-8 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-3">
                  <ShieldAlert className="text-orange-500" size={24} /> 
                  REGISTRO DE INFRACCIONES
                </h2>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">
                  SEDE PROTEGIDA • {totalAlumnosConIncidencias} ALUMNOS CON INFRACCIONES
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Selector de dispositivo */}
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-300 shadow-sm">
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

                {/* Selector de rango de tiempo */}
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-300 shadow-sm">
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

                {/* Botón LIMPIAR TODO (solo Director) */}
                <button
                  onClick={limpiarTodoFirebase}
                  disabled={isDeleting}
                  className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all"
                >
                  <Trash2 size={14} /> LIMPIAR TODO
                </button>

                {/* Contador de pendientes */}
                <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl">
                  <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest italic">
                    {totalPendientes} PENDIENTES
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Paginación */}
          <div className="px-6 pt-4 pb-2 flex justify-between items-center border-b border-slate-800">
            <p className="text-[8px] text-slate-500">
              Mostrando {paginatedAlumnos.length} de {totalAlumnosConIncidencias} alumnos
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

          {/* Lista de Alumnos con Infracciones (AGRUPADA) */}
          <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
            {paginatedAlumnos.length === 0 ? (
              <div className="p-20 text-center opacity-30 italic">
                <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                <p className="text-xs font-black uppercase tracking-widest">Sin infracciones registradas</p>
                <p className="text-[8px] text-slate-600 mt-2">
                  {selectedDevice !== 'all' ? 'Este dispositivo no tiene alertas en el período seleccionado' : getTimeRangeLabel(timeRange)}
                </p>
              </div>
            ) : (
              paginatedAlumnos.map((alumno) => {
                const totalInfracciones = alumno.totalInfracciones;
                const nivelAlerta = totalInfracciones >= 5 ? 'high' : totalInfracciones >= 2 ? 'medium' : 'low';
                const bgColor = nivelAlerta === 'high' ? 'bg-red-500/10' : nivelAlerta === 'medium' ? 'bg-orange-500/10' : 'bg-yellow-500/10';
                const alertaColor = nivelAlerta === 'high' ? 'text-red-500' : nivelAlerta === 'medium' ? 'text-orange-500' : 'text-yellow-500';
                
                return (
                  <div 
                    key={alumno.deviceId} 
                    className="p-6 flex items-center justify-between transition-all hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => setSelectedAlumno(alumno)}
                  >
                    <div className="flex items-center gap-5 flex-1">
                      <div className={`p-4 rounded-2xl ${bgColor}`}>
                        <AlertTriangle size={20} className={alertaColor} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-black text-sm uppercase italic tracking-tighter">
                            {alumno.alumnoNombre}
                          </p>
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">
                            Aula: {alumno.aulaId}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter italic ${bgColor} ${alertaColor}`}>
                            {totalInfracciones} {totalInfracciones === 1 ? 'INFRACCIÓN' : 'INFRACCIONES'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] font-medium leading-tight max-w-md break-all">
                          {alumno.primeraInfraccion.detalle || 'Acción Bloqueada'}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[9px] text-slate-600 font-black uppercase italic flex items-center gap-1 leading-none">
                            <Clock size={10} /> {formatFecha(alumno.primeraInfraccion.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 items-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlumno(alumno);
                        }}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black px-4 py-2 rounded-xl transition-all uppercase italic shadow-lg shadow-orange-500/20 flex items-center gap-2"
                      >
                        <Eye size={12} /> VER DETALLE
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.4em] italic">
            EDUControlPro - Security Operations Center
          </p>
        </div>
      </div>

      {/* MODAL PARA VER TODAS LAS INFRACCIONES DEL ALUMNO */}
      {modalOpen && selectedAlumno && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#0f1117] border border-orange-500/30 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Header del modal */}
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent">
              <div>
                <h3 className="text-white font-black text-xl uppercase flex items-center gap-2">
                  <ShieldAlert className="text-orange-500" size={22} />
                  {selectedAlumno.alumnoNombre}
                </h3>
                <p className="text-[9px] text-slate-500 mt-1">
                  Aula: {selectedAlumno.aulaId} • {selectedAlumno.totalInfracciones} infracciones en total
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportarInfraccionesAlumno(selectedAlumno)}
                  disabled={exportando}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all"
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 transition-colors"
                >
                  <X size={18} className="text-white" />
                </button>
              </div>
            </div>

            {/* Lista de infracciones del alumno */}
            <div className="overflow-y-auto max-h-[55vh] p-4 space-y-2">
              {selectedAlumno.infracciones
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((infraccion, idx) => {
                  const isRead = infraccion.leido === true;
                  return (
                    <div 
                      key={infraccion.id} 
                      className={`p-4 rounded-xl border transition-all ${isRead ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-900/50 border-orange-500/20'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isRead ? 'bg-slate-800/50' : 'bg-orange-500/10'}`}>
                          {getTipoIcon(infraccion.tipo)}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${getTipoColor(infraccion.tipo)}`}>
                                {getTipoLabel(infraccion.tipo)}
                              </span>
                              {!isRead && (
                                <span className="text-[7px] font-black px-2 py-0.5 rounded-md bg-red-500/20 text-red-400">
                                  PENDIENTE
                                </span>
                              )}
                            </div>
                            <span className="text-[8px] text-slate-500 font-mono">
                              {formatFecha(infraccion.timestamp)}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[10px] break-all">
                            {infraccion.detalle || 'Intento de acceso bloqueado'}
                          </p>
                          {!isRead && (
                            <button
                              onClick={() => markAsResolved(infraccion.id)}
                              className="mt-2 text-[7px] bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-white px-2 py-1 rounded transition-all"
                            >
                              Marcar como revisada
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer del modal */}
            <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>
    </>
  );
}