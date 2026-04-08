'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db, rtdb } from '@/firebase/config';
import { ref, query as rtdbQuery, orderByChild, startAt, get } from 'firebase/database';
import { collection, onSnapshot } from 'firebase/firestore';
import { ShieldX, Clock, Loader2, AlertTriangle, Smartphone, ShieldAlert, Lock, Eraser, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  appNombre?: string;
}

interface Aula {
  id: string;
  aulaId: string;
  seccion: string;
}

interface Alumno {
  deviceId: string;
  nombre: string;
  aulaId: string;
  seccion: string;
}

export function SecurityLogsTable({ institutionId }: { institutionId: string }) {
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [selectedAula, setSelectedAula] = useState<string>('');
  const [selectedSeccion, setSelectedSeccion] = useState<string>('');
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [logs, setLogs] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h' | '72h' | '30d'>('72h');
  
  const logsRef = useRef<HTMLDivElement>(null);

  // Tipos de alertas del Monitor Service que SI mostramos
  const allowedAlertTypes = useMemo(() => [
    'app_prohibida',
    'app_restringida',
    'admin_desactivado',
    'intento_desactivar_admin',
    'ajustes_sistema',
    'configuracion_navegador'
  ], []);

  // Cargar aulas desde Firestore
  useEffect(() => {
    if (!institutionId) return;

    const aulasRef = collection(db, "institutions", institutionId, "Aulas");
    const unsubscribe = onSnapshot(aulasRef, (snapshot) => {
      const aulasList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Aula[];
      setAulas(aulasList);
    });

    return () => unsubscribe();
  }, [institutionId]);

  // Cargar alumnos desde dispositivos RTDB
  useEffect(() => {
    if (!institutionId) return;

    const fetchAlumnos = async () => {
      try {
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await get(dispositivosRef);
        const data = snapshot.val();
        const alumnosList: Alumno[] = [];

        if (data) {
          Object.entries(data).forEach(([deviceId, device]: [string, any]) => {
            if (device.InstitutoId === institutionId && device.rol === 'alumno') {
              alumnosList.push({
                deviceId: deviceId,
                nombre: device.alumno_asignado || device.nombre || 'Sin nombre',
                aulaId: device.aulaId || '',
                seccion: device.seccion || ''
              });
            }
          });
        }

        setAlumnos(alumnosList);
        setLoading(false);
      } catch (error) {
        console.error('Error cargando alumnos:', error);
        setLoading(false);
      }
    };

    fetchAlumnos();
  }, [institutionId]);

  // Opciones únicas de secciones por aula
  const seccionesDisponibles = useMemo(() => {
    const alumnosFiltrados = alumnos.filter(a => a.aulaId === selectedAula);
    const secciones = [...new Set(alumnosFiltrados.map(a => a.seccion))];
    return secciones.filter(s => s);
  }, [alumnos, selectedAula]);

  // Alumnos filtrados por aula y sección
  const alumnosFiltrados = useMemo(() => {
    return alumnos.filter(a => 
      a.aulaId === selectedAula && 
      a.seccion === selectedSeccion
    );
  }, [alumnos, selectedAula, selectedSeccion]);

  // Limpiar todos los filtros
  const handleClearFilters = () => {
    setSelectedAula('');
    setSelectedSeccion('');
    setSelectedAlumno(null);
    setLogs([]);
    toast.success('Filtros limpiados');
  };

  // Exportar a PDF
  const handleExportPDF = async () => {
    if (!logsRef.current || logs.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    toast.info('Generando PDF...');
    
    try {
      const element = logsRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0f1117',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`alertas_seguridad_${selectedAlumno?.nombre || 'general'}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success('PDF exportado correctamente');
    } catch (error) {
      console.error('Error exportando PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  // Obtener timestamp según rango seleccionado
  const getTimeRangeTimestamp = (range: string): number => {
    const now = Date.now();
    switch(range) {
      case '24h': return now - (24 * 60 * 60 * 1000);
      case '72h': return now - (72 * 60 * 60 * 1000);
      case '30d': return now - (30 * 24 * 60 * 60 * 1000);
      default: return now - (72 * 60 * 60 * 1000);
    }
  };

  const getTimeRangeLabel = (range: string): string => {
    switch(range) {
      case '24h': return 'últimas 24 horas';
      case '72h': return 'últimas 72 horas';
      case '30d': return 'últimos 30 días';
      default: return 'últimas 72 horas';
    }
  };

  // Extraer nombre de la app del detalle
  const extractAppName = (detalle: string): string => {
    const appMatch = detalle.match(/abrir: ([\w.]+)/i);
    if (appMatch) {
      return appMatch[1].split('.').pop() || appMatch[1];
    }
    return '';
  };

  // Cargar alertas del alumno seleccionado (SOLO Monitor Service)
  const loadAlumnoLogs = useCallback(async () => {
    if (!selectedAlumno) return;

    setLoadingLogs(true);
    try {
      const alertasRef = ref(rtdb, 'alertas_seguridad');
      const timeLimit = getTimeRangeTimestamp(timeRange);
      const alertsQuery = rtdbQuery(alertasRef, orderByChild('timestamp'), startAt(timeLimit));
      
      const snapshot = await get(alertsQuery);
      const data = snapshot.val();
      
      if (data) {
        const alertasList: SecurityAlert[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: value.deviceId || ''
          }))
          .filter(alert => {
            // SOLO mostrar tipos permitidos del Monitor Service
            if (!allowedAlertTypes.includes(alert.tipo)) return false;
            // Filtrar por dispositivo del alumno seleccionado
            return alert.deviceId === selectedAlumno.deviceId;
          })
          .map(alert => ({
            ...alert,
            appNombre: extractAppName(alert.detalle)
          }))
          .sort((a, b) => b.timestamp - a.timestamp);

        setLogs(alertasList);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Error cargando alertas:', error);
      toast.error('Error al cargar alertas de seguridad');
    } finally {
      setLoadingLogs(false);
    }
  }, [selectedAlumno, timeRange, allowedAlertTypes]);

  // Recargar cuando cambia el alumno o el rango de tiempo
  useEffect(() => {
    if (selectedAlumno) {
      loadAlumnoLogs();
    }
  }, [selectedAlumno, timeRange, loadAlumnoLogs]);

  const getTipoInfo = (tipo: string, detalle: string, appNombre?: string) => {
    switch(tipo) {
      case 'app_prohibida':
      case 'app_restringida':
        return { 
          label: appNombre ? `App prohibida: ${appNombre}` : 'App prohibida', 
          icon: <Smartphone className="w-4 h-4" />, 
          color: 'text-orange-500', 
          bgColor: 'bg-orange-500/10' 
        };
      case 'admin_desactivado':
      case 'intento_desactivar_admin':
        return { 
          label: 'Intento de desactivar permisos de administrador', 
          icon: <ShieldAlert className="w-4 h-4" />, 
          color: 'text-red-600', 
          bgColor: 'bg-red-500/20' 
        };
      case 'ajustes_sistema':
        return { 
          label: 'Intento de acceso a Ajustes del Sistema', 
          icon: <ShieldX className="w-4 h-4" />, 
          color: 'text-purple-500', 
          bgColor: 'bg-purple-500/10' 
        };
      case 'configuracion_navegador':
        return { 
          label: 'Intento de acceso a Configuración del Navegador', 
          icon: <ShieldAlert className="w-4 h-4" />, 
          color: 'text-yellow-500', 
          bgColor: 'bg-yellow-500/10' 
        };
      default:
        return { 
          label: 'Alerta de seguridad', 
          icon: <AlertTriangle className="w-4 h-4" />, 
          color: 'text-slate-500', 
          bgColor: 'bg-slate-500/10' 
        };
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Hoy ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Ayer ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-12 text-center">
        <Loader2 className="animate-spin w-8 h-8 text-orange-500 mx-auto mb-4" />
        <p className="text-orange-500 font-black text-[11px] uppercase">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6 mt-8">
      {/* TÍTULO Y BOTONES */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-2 rounded-xl">
            <ShieldX className="text-red-500 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black italic uppercase text-white tracking-tighter">
              Alertas de <span className="text-red-500">Seguridad</span>
            </h2>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
              Monitor Service | Apps prohibidas | Permisos Admin | Ajustes
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white text-[10px] font-black uppercase italic transition-all"
          >
            <Eraser size={14} />
            Limpiar Filtros
          </button>
          {selectedAlumno && logs.length > 0 && (
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-xl text-white text-[10px] font-black uppercase italic transition-all"
            >
              <FileText size={14} />
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Aula</label>
          <select
            value={selectedAula}
            onChange={(e) => {
              setSelectedAula(e.target.value);
              setSelectedSeccion('');
              setSelectedAlumno(null);
              setLogs([]);
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-[11px] font-bold uppercase"
          >
            <option value="">-- SELECCIONAR AULA --</option>
            {aulas.map(aula => (
              <option key={aula.id} value={aula.aulaId}>{aula.aulaId}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Sección</label>
          <select
            value={selectedSeccion}
            onChange={(e) => {
              setSelectedSeccion(e.target.value);
              setSelectedAlumno(null);
              setLogs([]);
            }}
            disabled={!selectedAula}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-[11px] font-bold uppercase disabled:opacity-50"
          >
            <option value="">-- SELECCIONAR SECCIÓN --</option>
            {seccionesDisponibles.map(seccion => (
              <option key={seccion} value={seccion}>{seccion}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Alumno</label>
          <select
            value={selectedAlumno?.deviceId || ''}
            onChange={(e) => {
              const alumno = alumnosFiltrados.find(a => a.deviceId === e.target.value);
              setSelectedAlumno(alumno || null);
            }}
            disabled={!selectedSeccion}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-[11px] font-bold uppercase disabled:opacity-50"
          >
            <option value="">-- SELECCIONAR ALUMNO --</option>
            {alumnosFiltrados.map(alumno => (
              <option key={alumno.deviceId} value={alumno.deviceId}>{alumno.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SELECTOR DE RANGO DE TIEMPO */}
      {selectedAlumno && (
        <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${
              timeRange === '24h' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Últimas 24 Horas
          </button>
          <button
            onClick={() => setTimeRange('72h')}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${
              timeRange === '72h' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Últimas 72 Horas
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${
              timeRange === '30d' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Últimos 30 Días
          </button>
        </div>
      )}

      {/* LISTA DE ALERTAS - PARA EXPORTAR PDF */}
      <div ref={logsRef}>
        {selectedAlumno && (
          <div className="space-y-3 pt-4">
            {loadingLogs ? (
              <div className="py-12 text-center">
                <Loader2 className="animate-spin w-6 h-6 text-orange-500 mx-auto" />
                <p className="text-[9px] text-slate-500 mt-2">Cargando alertas...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl">
                <ShieldX className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-30" />
                <p className="text-[10px] text-slate-500 font-black uppercase">
                  No hay alertas de seguridad para {selectedAlumno.nombre}
                </p>
                <p className="text-[8px] text-slate-600 mt-1">
                  ({getTimeRangeLabel(timeRange)})
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[9px] text-slate-500">
                    Mostrando {logs.length} alertas ({getTimeRangeLabel(timeRange)})
                  </p>
                </div>
                {logs.map((log) => {
                  const tipoInfo = getTipoInfo(log.tipo, log.detalle, log.appNombre);
                  return (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-red-500/[0.03] transition-all">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-3 rounded-xl ${tipoInfo.bgColor}`}>
                          {React.cloneElement(tipoInfo.icon, { className: `w-4 h-4 ${tipoInfo.color}` })}
                        </div>
                        <div className="space-y-1 flex-1">
                          <p className="text-[11px] font-black text-slate-200 uppercase truncate max-w-[350px] italic">
                            {tipoInfo.label}
                          </p>
                          <div className="flex items-center gap-2">
                            <Clock size={10} className="text-slate-600" />
                            <span className="text-[9px] font-mono text-slate-500">
                              {formatDate(log.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-slate-600 font-mono">
                          {log.deviceId.substring(0, 10)}...
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* MENSAJE CUANDO NO HAY SELECCIÓN */}
        {!selectedAlumno && (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl">
            <ShieldX className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-30" />
            <p className="text-[10px] text-slate-500 font-black uppercase">
              Seleccione un alumno para ver sus alertas de seguridad
            </p>
          </div>
        )}
      </div>
    </div>
  );
}