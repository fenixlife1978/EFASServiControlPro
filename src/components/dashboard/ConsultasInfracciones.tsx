'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { ref, onValue, off, set } from 'firebase/database';
import { 
  ShieldAlert, Download, Trash2, ChevronLeft, ChevronRight, X, History, Eraser, 
  AlertTriangle, MessageSquare
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface Alerta {
  id: string;
  descripcion?: string;
  urlIntentada?: string;
  timestamp: number;
  tipo?: string;
  deviceId?: string;
  detalle?: string;
}

interface Dispositivo {
  id: string;
  alumno_asignado: string;
  aulaId: string;
  seccion: string;
  ultimaUrl?: string;
  online?: boolean;
}

interface Aula {
  id: string;
  aulaId: string;
  seccion: string;
}

type VistaActual = 'infracciones_dia' | 'historial_30d' | null;

export function ConsultasInfracciones({ institutoId }: { institutoId: string }) {
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [aulaSeleccionada, setAulaSeleccionada] = useState<string>('');
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string>('');
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<Dispositivo | null>(null);
  
  const [alertasMostradas, setAlertasMostradas] = useState<Alerta[]>([]);
  const [vistaActual, setVistaActual] = useState<VistaActual>(null);
  const [cargando, setCargando] = useState(false);
  
  const [mensajeModalOpen, setMensajeModalOpen] = useState(false);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [alertasCache, setAlertasCache] = useState<Record<string, Alerta[]>>({});
  
  useEffect(() => {
    if (!institutoId) return;
    const aulasRef = collection(db, 'institutions', institutoId, 'Aulas');
    const unsubscribe = onSnapshot(aulasRef, (snapshot) => {
      const aulasList = snapshot.docs.map(doc => ({
        id: doc.id,
        aulaId: doc.data().aulaId,
        seccion: doc.data().seccion
      }));
      setAulas(aulasList);
    });
    return () => unsubscribe();
  }, [institutoId]);
  
  useEffect(() => {
    if (!institutoId) return;
    const dispositivosRef = ref(rtdb, 'dispositivos');
    const unsubscribe = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const dispositivosList: Dispositivo[] = [];
        Object.entries(data).forEach(([id, device]: [string, any]) => {
          if (device.InstitutoId === institutoId && (device.rol === 'alumno' || device.alumno_asignado)) {
            dispositivosList.push({
              id,
              alumno_asignado: device.alumno_asignado || 'Sin nombre',
              aulaId: device.aulaId || '',
              seccion: device.seccion || '',
              ultimaUrl: device.ultimaUrl || '',
              online: device.online || false
            });
          }
        });
        setDispositivos(dispositivosList);
      }
    });
    return () => off(dispositivosRef);
  }, [institutoId]);
  
  useEffect(() => {
    if (!institutoId) return;
    const alertasRef = ref(rtdb, 'alertas_seguridad');
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      const cache: Record<string, Alerta[]> = {};
      if (data) {
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          const alerta: Alerta = {
            id: key,
            timestamp: value.timestamp || 0,
            tipo: value.tipo || 'desconocido',
            descripcion: value.detalle || '',
            urlIntentada: value.detalle || '',
            deviceId: value.deviceId || ''
          };
          if (alerta.deviceId) {
            if (!cache[alerta.deviceId]) cache[alerta.deviceId] = [];
            cache[alerta.deviceId].push(alerta);
          }
        });
        Object.keys(cache).forEach(deviceId => {
          cache[deviceId].sort((a, b) => b.timestamp - a.timestamp);
        });
      }
      setAlertasCache(cache);
    });
    return () => off(alertasRef);
  }, [institutoId]);
  
  const aulasUnicas = useMemo(() => {
    const aulasSet = new Set<string>();
    aulas.forEach(a => aulasSet.add(a.aulaId));
    return Array.from(aulasSet).sort();
  }, [aulas]);
  
  const seccionesDisponibles = useMemo(() => {
    if (!aulaSeleccionada) return [];
    const seccionesSet = new Set<string>();
    aulas.filter(a => a.aulaId === aulaSeleccionada).forEach(a => seccionesSet.add(a.seccion));
    return Array.from(seccionesSet).sort();
  }, [aulas, aulaSeleccionada]);
  
  const alumnosFiltrados = useMemo(() => {
    if (!aulaSeleccionada) return [];
    return dispositivos.filter(d => d.aulaId === aulaSeleccionada && (!seccionSeleccionada || d.seccion === seccionSeleccionada));
  }, [dispositivos, aulaSeleccionada, seccionSeleccionada]);
  
  const getStartOfDay = (): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  };
  
  const get30DaysAgo = (): number => {
    return Date.now() - (30 * 24 * 60 * 60 * 1000);
  };
  
  const verInfraccionesDia = () => {
    if (!alumnoSeleccionado) return;
    setCargando(true);
    const alertasAlumno = alertasCache[alumnoSeleccionado.id] || [];
    const startOfDay = getStartOfDay();
    const filtradas = alertasAlumno.filter(a => a.timestamp >= startOfDay);
    setAlertasMostradas(filtradas);
    setVistaActual('infracciones_dia');
    setCurrentPage(1);
    setCargando(false);
    toast.success(`📋 ${filtradas.length} infracciones encontradas hoy`);
  };
  
  const verHistorial30Dias = () => {
    if (!alumnoSeleccionado) return;
    setCargando(true);
    const alertasAlumno = alertasCache[alumnoSeleccionado.id] || [];
    const thirtyDaysAgo = get30DaysAgo();
    const filtradas = alertasAlumno.filter(a => a.timestamp >= thirtyDaysAgo);
    setAlertasMostradas(filtradas);
    setVistaActual('historial_30d');
    setCurrentPage(1);
    setCargando(false);
    toast.success(`📋 ${filtradas.length} infracciones en los últimos 30 días`);
  };
  
  const limpiarHistorialDia = () => {
    if (!alumnoSeleccionado) return;
    setAlertasMostradas([]);
    setVistaActual(null);
    toast.info('🧹 Historial limpiado de la pantalla (los datos persisten en el sistema)');
  };
  
  const enviarMensajeDirector = async () => {
    if (!alumnoSeleccionado || !mensajeTexto.trim()) return;
    setEnviandoMensaje(true);
    try {
      const mensajeRef = ref(rtdb, `mensajes_dispositivos/${alumnoSeleccionado.id}/ultimo_mensaje`);
      await set(mensajeRef, {
        texto: mensajeTexto,
        remitente: "Dirección Institucional",
        timestamp: Date.now(),
        leido: false,
        id: "msg_" + Date.now(),
        titulo: "Mensaje de Dirección"
      });
      toast.success('Mensaje enviado correctamente');
      setMensajeTexto('');
      setMensajeModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Error al enviar mensaje');
    } finally {
      setEnviandoMensaje(false);
    }
  };
  
  const exportarPDF = () => {
    if (!vistaActual) {
      toast.warning('Seleccione una consulta primero');
      return;
    }
    try {
      const docPDF = new jsPDF();
      docPDF.setFillColor(15, 17, 23);
      docPDF.rect(0, 0, 210, 40, 'F');
      docPDF.setTextColor(255, 255, 255);
      docPDF.setFontSize(16);
      docPDF.text('EDUCONTROLPRO - REPORTE', 15, 20);
      docPDF.setFontSize(8);
      docPDF.setTextColor(249, 115, 22);
      docPDF.text(`Generado: ${new Date().toLocaleString()}`, 15, 28);
      docPDF.text(`Alumno: ${alumnoSeleccionado?.alumno_asignado}`, 15, 36);
      docPDF.text(`Aula: ${alumnoSeleccionado?.aulaId} - Sección: ${alumnoSeleccionado?.seccion}`, 15, 44);
      
      const rows = alertasMostradas.map(a => [
        new Date(a.timestamp).toLocaleString(),
        a.tipo || 'Alerta',
        a.descripcion?.substring(0, 50) || a.urlIntentada?.substring(0, 50) || ''
      ]);
      autoTable(docPDF, {
        head: [['Fecha/Hora', 'Tipo', 'Descripción']],
        body: rows,
        startY: 52,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [249, 115, 22] }
      });
      docPDF.save(`EDUControlPro_${alumnoSeleccionado?.alumno_asignado}_${Date.now()}.pdf`);
      toast.success('PDF exportado correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al exportar PDF');
    }
  };
  
  const limpiarTodo = () => {
    setAulaSeleccionada('');
    setSeccionSeleccionada('');
    setAlumnoSeleccionado(null);
    setAlertasMostradas([]);
    setVistaActual(null);
    setCurrentPage(1);
    toast.success('🧹 Todo ha sido limpiado');
  };
  
  const getNombreVista = (): string => {
    switch(vistaActual) {
      case 'infracciones_dia': return 'Infracciones del día';
      case 'historial_30d': return 'Historial de infracciones (30 días)';
      default: return 'Reporte';
    }
  };
  
  const datosMostrados = alertasMostradas;
  const totalPages = Math.ceil(datosMostrados.length / itemsPerPage);
  const datosPaginados = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return datosMostrados.slice(start, start + itemsPerPage);
  }, [datosMostrados, currentPage, itemsPerPage]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [vistaActual]);
  
  return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-white font-black uppercase italic text-lg flex items-center gap-3">
            <ShieldAlert className="text-orange-500" size={24} />
            CONSULTAS DE <span className="text-orange-500">INFRACCIONES</span>
          </h3>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            SELECCIONE AULA, SECCIÓN Y ALUMNO PARA VER SUS INFRACCIONES
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarPDF} disabled={!vistaActual} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-[9px] font-black flex items-center gap-2 disabled:opacity-50 transition-all">
            <Download size={14} /> PDF
          </button>
          <button onClick={limpiarTodo} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl text-[9px] font-black flex items-center gap-2 transition-all">
            <Trash2 size={14} /> LIMPIAR TODO
          </button>
        </div>
      </div>
      
      <div className="bg-black/40 p-5 rounded-3xl border border-slate-800 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[8px] text-slate-400 uppercase block mb-1">Aula</label>
            <select value={aulaSeleccionada} onChange={(e) => { setAulaSeleccionada(e.target.value); setSeccionSeleccionada(''); setAlumnoSeleccionado(null); }} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-[11px] font-medium focus:outline-none focus:border-orange-500 transition-colors">
              <option value="">-- SELECCIONAR AULA --</option>
              {aulasUnicas.map(aula => <option key={aula} value={aula}>{aula}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-slate-400 uppercase block mb-1">Sección</label>
            <select value={seccionSeleccionada} onChange={(e) => { setSeccionSeleccionada(e.target.value); setAlumnoSeleccionado(null); }} disabled={!aulaSeleccionada} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-[11px] font-medium disabled:opacity-50 focus:outline-none focus:border-orange-500 transition-colors">
              <option value="">-- SELECCIONAR SECCIÓN --</option>
              {seccionesDisponibles.map(seccion => <option key={seccion} value={seccion}>{seccion}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-slate-400 uppercase block mb-1">Alumno</label>
            <select 
              value={alumnoSeleccionado?.id || ''} 
              onChange={(e) => { 
                const alumno = alumnosFiltrados.find(a => a.id === e.target.value); 
                setAlumnoSeleccionado(alumno || null); 
                setAlertasMostradas([]); 
                setVistaActual(null); 
              }} 
              disabled={!seccionSeleccionada} 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-[11px] font-medium disabled:opacity-50 focus:outline-none focus:border-orange-500 transition-colors"
            >
              <option value="">-- SELECCIONAR --</option>
              {alumnosFiltrados.map(alumno => (
                <option key={alumno.id} value={alumno.id}>{alumno.alumno_asignado}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-800">
          <button onClick={verInfraccionesDia} disabled={!alumnoSeleccionado} className="bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black flex items-center gap-2 transition-all disabled:opacity-50">
            <AlertTriangle size={12} /> INFRACCIONES DEL DÍA
          </button>
          <button onClick={verHistorial30Dias} disabled={!alumnoSeleccionado} className="bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black flex items-center gap-2 transition-all disabled:opacity-50">
            <History size={12} /> HISTORIAL 30 DÍAS
          </button>
          <button onClick={() => setMensajeModalOpen(true)} disabled={!alumnoSeleccionado} className="bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black flex items-center gap-2 transition-all disabled:opacity-50 ml-auto">
            <MessageSquare size={12} /> ENVIAR MENSAJE
          </button>
        </div>
      </div>
      
      {vistaActual && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <div className="bg-orange-500 p-1 rounded-lg"><ShieldAlert size={12} /></div>
              {getNombreVista()}
            </h4>
            <button onClick={limpiarHistorialDia} className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Eraser size={10} /> LIMPIAR PANTALLA
            </button>
          </div>
          
          {cargando ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-500 text-xs">Cargando datos...</p>
            </div>
          ) : datosPaginados.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl">
              <AlertTriangle className="text-slate-600 mx-auto mb-2" size={32} />
              <p className="text-slate-500 text-xs">No hay infracciones para mostrar</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-800">
                    <tr className="text-slate-400">
                      <th className="text-left py-2 px-2">FECHA/HORA</th>
                      <th className="text-left py-2 px-2">TIPO</th>
                      <th className="text-left py-2 px-2">DESCRIPCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosPaginados.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                        <td className="py-2 px-2 text-slate-300 whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[9px]">
                            {item.tipo || 'Bloqueo'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-400">
                          {item.descripcion?.substring(0, 80)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 bg-slate-800 rounded-lg disabled:opacity-50">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[9px] text-slate-400">Página {currentPage} de {totalPages}</span>
                  <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 bg-slate-800 rounded-lg disabled:opacity-50">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {mensajeModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#0f1117] border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-white font-black uppercase text-sm">Enviar Mensaje a {alumnoSeleccionado?.alumno_asignado}</h3>
              <button onClick={() => setMensajeModalOpen(false)} className="text-slate-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <textarea
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm"
                rows={4}
                placeholder="Escribe el mensaje para el alumno..."
                value={mensajeTexto}
                onChange={(e) => setMensajeTexto(e.target.value)}
              />
              <div className="flex gap-3 mt-5">
                <button onClick={() => setMensajeModalOpen(false)} className="flex-1 py-2 bg-slate-800 rounded-xl text-white text-xs">Cancelar</button>
                <button onClick={enviarMensajeDirector} disabled={enviandoMensaje} className="flex-1 py-2 bg-orange-500 rounded-xl text-white text-xs font-black disabled:opacity-50">
                  {enviandoMensaje ? 'ENVIANDO...' : 'ENVIAR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}