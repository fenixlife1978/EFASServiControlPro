'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, onSnapshot, query as fsQuery, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, onValue, off, get, orderByChild, limitToLast, startAt, query as rtdbQuery } from 'firebase/database';
import { 
  ShieldX, Globe, Clock, Tablet, Loader2, AlertTriangle, 
  Smartphone, ShieldAlert, Lock, ChevronLeft, ChevronRight, 
  Send, History, Calendar, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

interface Infraccion {
  id: string;
  timestamp: number;
  dominio?: string;
  categoria?: string;
  dispositivo?: string;
  alumno?: string;
}

interface HistorialNavegacion {
  id: string;
  url: string;
  timestamp: number;
  deviceId: string;
  titulo?: string;
}

export function ConsultasInfracciones({ institutionId }: { institutionId: string }) {
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [selectedAula, setSelectedAula] = useState<string>('');
  const [selectedSeccion, setSelectedSeccion] = useState<string>('');
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  
  const [infracciones, setInfracciones] = useState<Infraccion[]>([]);
  const [historialNavegacion, setHistorialNavegacion] = useState<HistorialNavegacion[]>([]);
  const [modoHistorial, setModoHistorial] = useState<'infracciones' | 'historial'>('infracciones');
  const [rangoHistorial, setRangoHistorial] = useState<'dia' | '30dias'>('dia');
  
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const logsRef = useRef<HTMLDivElement>(null);

  // Cargar aulas
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

  // Cargar alumnos
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

  // Opciones de secciones
  const seccionesDisponibles = useMemo(() => {
    const alumnosFiltrados = alumnos.filter(a => a.aulaId === selectedAula);
    const secciones = [...new Set(alumnosFiltrados.map(a => a.seccion))];
    return secciones.filter(s => s);
  }, [alumnos, selectedAula]);

  // Alumnos filtrados
  const alumnosFiltrados = useMemo(() => {
    return alumnos.filter(a => a.aulaId === selectedAula && a.seccion === selectedSeccion);
  }, [alumnos, selectedAula, selectedSeccion]);

  // Limpiar filtros
  const handleClearFilters = () => {
    setSelectedAula('');
    setSelectedSeccion('');
    setSelectedAlumno(null);
    setInfracciones([]);
    setHistorialNavegacion([]);
    setModoHistorial('infracciones');
    toast.success('Filtros limpiados');
  };

  // Exportar a PDF
  const handleExportPDF = async () => {
    if (!logsRef.current) {
      toast.error('No hay datos para exportar');
      return;
    }
    toast.info('Generando PDF...');
    try {
      const element = logsRef.current;
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0f1117', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      const titulo = modoHistorial === 'infracciones' ? 'infracciones' : 'historial_navegacion';
      pdf.save(`${titulo}_${selectedAlumno?.nombre || 'general'}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exportado correctamente');
    } catch (error) {
      console.error('Error exportando PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  // Cargar infracciones de NextDNS (desde Firestore)
  const cargarInfracciones = useCallback(async () => {
    if (!selectedAlumno || !institutionId) return;
    setLoadingData(true);
    try {
      const logsRef = collection(db, "institutions", institutionId, "logs");
      const q = fsQuery(logsRef, where("deviceId", "==", selectedAlumno.deviceId));
      const snapshot = await getDocs(q);
      const infraccionesList: Infraccion[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        infraccionesList.push({
          id: doc.id,
          timestamp: data.timestamp || 0,
          dominio: data.dominio || data.url || '',
          categoria: data.categoria || 'bloqueado',
          dispositivo: data.deviceId,
          alumno: selectedAlumno.nombre
        });
      });
      infraccionesList.sort((a, b) => b.timestamp - a.timestamp);
      setInfracciones(infraccionesList);
    } catch (error) {
      console.error('Error cargando infracciones:', error);
      toast.error('Error al cargar infracciones');
    } finally {
      setLoadingData(false);
    }
  }, [selectedAlumno, institutionId]);

  // Cargar historial de navegación del Monitor Service
  const cargarHistorialNavegacion = useCallback(async () => {
    if (!selectedAlumno) return;
    setLoadingData(true);
    try {
      const historialRef = ref(rtdb, `historial_navegacion/${selectedAlumno.deviceId}`);
      const timeLimit = Date.now() - (rangoHistorial === 'dia' ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000);
      const historyQuery = rtdbQuery(historialRef, orderByChild('timestamp'), startAt(timeLimit));
      const snapshot = await get(historyQuery);
      const data = snapshot.val();
      const historialList: HistorialNavegacion[] = [];
      if (data) {
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          historialList.push({
            id: key,
            url: value.url || '',
            timestamp: value.timestamp || 0,
            deviceId: value.deviceId || selectedAlumno.deviceId,
            titulo: value.titulo || ''
          });
        });
      }
      historialList.sort((a, b) => b.timestamp - a.timestamp);
      setHistorialNavegacion(historialList);
    } catch (error) {
      console.error('Error cargando historial:', error);
      toast.error('Error al cargar historial de navegación');
    } finally {
      setLoadingData(false);
    }
  }, [selectedAlumno, rangoHistorial]);

  // Efecto para cargar según el modo
  useEffect(() => {
    if (selectedAlumno) {
      if (modoHistorial === 'infracciones') {
        cargarInfracciones();
      } else {
        cargarHistorialNavegacion();
      }
    }
  }, [selectedAlumno, modoHistorial, rangoHistorial, cargarInfracciones, cargarHistorialNavegacion]);

  // Paginación
  const datosMostrados = modoHistorial === 'infracciones' ? infracciones : historialNavegacion;
  const totalPages = Math.ceil(datosMostrados.length / itemsPerPage);
  const datosPaginados = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return datosMostrados.slice(start, start + itemsPerPage);
  }, [datosMostrados, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAlumno, modoHistorial, rangoHistorial]);

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
              Consultas de <span className="text-red-500">Infracciones</span>
            </h2>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
              NextDNS | Bloqueos de dominios
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white text-[10px] font-black uppercase italic transition-all"
          >
            Limpiar Filtros
          </button>
          {selectedAlumno && datosMostrados.length > 0 && (
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-xl text-white text-[10px] font-black uppercase italic transition-all"
            >
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

      {/* BOTONES DE MODO */}
      {selectedAlumno && (
        <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
          <button
            onClick={() => {
              setModoHistorial('infracciones');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${
              modoHistorial === 'infracciones' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <ShieldX size={12} />
            Infracciones (NextDNS)
          </button>
          <button
            onClick={() => {
              setModoHistorial('historial');
              setCurrentPage(1);
              setRangoHistorial('dia');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${
              modoHistorial === 'historial' && rangoHistorial === 'dia'
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Calendar size={12} />
            Historial del Día
          </button>
          <button
            onClick={() => {
              setModoHistorial('historial');
              setCurrentPage(1);
              setRangoHistorial('30dias');
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${
              modoHistorial === 'historial' && rangoHistorial === '30dias'
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <History size={12} />
            Historial 30 Días
          </button>
        </div>
      )}

      {/* CONTENIDO */}
      <div ref={logsRef}>
        {selectedAlumno ? (
          <div className="space-y-3 pt-4">
            {loadingData ? (
              <div className="py-12 text-center">
                <Loader2 className="animate-spin w-6 h-6 text-orange-500 mx-auto" />
                <p className="text-[9px] text-slate-500 mt-2">Cargando...</p>
              </div>
            ) : datosPaginados.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl">
                {modoHistorial === 'infracciones' ? (
                  <>
                    <ShieldX className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-30" />
                    <p className="text-[10px] text-slate-500 font-black uppercase">
                      No hay infracciones registradas para {selectedAlumno.nombre}
                    </p>
                  </>
                ) : (
                  <>
                    <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-30" />
                    <p className="text-[10px] text-slate-500 font-black uppercase">
                      No hay historial de navegación para {selectedAlumno.nombre}
                    </p>
                    <p className="text-[8px] text-slate-600 mt-1">
                      {rangoHistorial === 'dia' ? '(últimas 24 horas)' : '(últimos 30 días)'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[9px] text-slate-500">
                    Mostrando {datosPaginados.length} de {datosMostrados.length} registros
                  </p>
                </div>
                {datosPaginados.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-red-500/[0.03] transition-all">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-3 rounded-xl bg-red-500/10">
                        {modoHistorial === 'infracciones' ? (
                          <Globe className="w-4 h-4 text-red-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="text-[11px] font-black text-slate-200 truncate max-w-[350px] italic">
                          {modoHistorial === 'infracciones' 
                            ? (item as Infraccion).dominio || 'Dominio bloqueado'
                            : (item as HistorialNavegacion).url || 'URL visitada'
                          }
                        </p>
                        <div className="flex items-center gap-2">
                          <Clock size={10} className="text-slate-600" />
                          <span className="text-[9px] font-mono text-slate-500">
                            {formatDate(item.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl">
            <ShieldX className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-30" />
            <p className="text-[10px] text-slate-500 font-black uppercase">
              Seleccione un alumno para ver sus consultas
            </p>
          </div>
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={16} className="text-white" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={16} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}