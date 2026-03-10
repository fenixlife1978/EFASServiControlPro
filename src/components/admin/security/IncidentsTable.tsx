'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  ShieldAlert, Globe, Monitor, Trash2, Clock, CheckCircle, MessageSquare, History, 
  Search, Calendar, Download, Share2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface IncidentsTableProps {
  institutionId: string;
  onViewHistory?: (deviceId: string, alumnoNombre: string) => void;
  onSendMessage?: (deviceId: string, alumnoNombre: string) => void;
}

export function IncidentsTable({ institutionId, onViewHistory, onSendMessage }: IncidentsTableProps) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Cargar incidencias desde la colección global "alertas"
  useEffect(() => {
    if (!institutionId) return;

    const q = query(
      collection(db, "alertas"),
      where("InstitutoId", "==", institutionId),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
      }));
      setIncidents(data);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando incidencias:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId]);

  // Aplicar filtros cuando cambien los criterios o los datos
  useEffect(() => {
    let filtradas = incidents;

    // Filtrar por nombre (sin distinguir mayúsculas)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtradas = filtradas.filter(inc => 
        (inc.estudianteNombre?.toLowerCase().includes(term)) ||
        (inc.alumno_asignado?.toLowerCase().includes(term)) ||
        (inc.aulaId?.toLowerCase().includes(term)) // También buscar por aula
      );
    }

    // Filtrar por rango de fechas
    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      filtradas = filtradas.filter(inc => {
        const fecha = inc.timestamp instanceof Date ? inc.timestamp : new Date(inc.timestamp);
        return fecha >= inicio;
      });
    }
    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      filtradas = filtradas.filter(inc => {
        const fecha = inc.timestamp instanceof Date ? inc.timestamp : new Date(inc.timestamp);
        return fecha <= fin;
      });
    }

    setFilteredIncidents(filtradas);
  }, [incidents, searchTerm, fechaInicio, fechaFin]);

  const markAsResolved = async (id: string) => {
    try {
      const alertRef = doc(db, "alertas", id);
      await updateDoc(alertRef, {
        status: 'visto',
        resolvedAt: new Date()
      });
    } catch (error) {
      console.error("Error marcando como visto:", error);
    }
  };

  const deleteIncident = async (id: string) => {
    if (!confirm("¿Eliminar este registro de infracción?")) return;
    try {
      const alertRef = doc(db, "alertas", id);
      await deleteDoc(alertRef);
    } catch (error) {
      console.error("Error eliminando incidencia:", error);
    }
  };

  // Función para compartir usando Web Share API
  const handleShare = async () => {
    if (filteredIncidents.length === 0) {
      alert('No hay datos para compartir');
      return;
    }

    const texto = `Reporte de incidencias - ${new Date().toLocaleDateString()}\n` +
      `Filtros: ${searchTerm ? `Alumno/Aula: ${searchTerm}` : 'Todos'} ` +
      `${fechaInicio ? `desde ${fechaInicio}` : ''} ${fechaFin ? `hasta ${fechaFin}` : ''}\n\n` +
      filteredIncidents.map(inc => 
        `- ${inc.estudianteNombre || inc.alumno_asignado || 'Desconocido'} (Aula: ${inc.aulaId || 'N/A'}): ${inc.descripcion || inc.urlIntentada || inc.url} (${new Date(inc.timestamp).toLocaleString()})`
      ).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Reporte de Incidencias',
          text: texto,
        });
      } catch (error) {
        console.error('Error al compartir:', error);
      }
    } else {
      // Fallback: copiar al portapapeles
      navigator.clipboard.writeText(texto).then(() => {
        alert('Texto copiado al portapapeles');
      }).catch(() => {
        alert('No se pudo compartir');
      });
    }
  };

  // Función para generar PDF
  const generatePDF = () => {
    if (filteredIncidents.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    setExportando(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Reporte de Incidencias', 14, 22);
      doc.setFontSize(10);
      doc.text(`Institución: ${institutionId}`, 14, 32);
      if (searchTerm) doc.text(`Filtro: ${searchTerm}`, 14, 38);
      if (fechaInicio || fechaFin) {
        let fechaTexto = 'Período: ';
        if (fechaInicio) fechaTexto += `desde ${new Date(fechaInicio).toLocaleDateString()}`;
        if (fechaFin) fechaTexto += ` hasta ${new Date(fechaFin).toLocaleDateString()}`;
        doc.text(fechaTexto, 14, 44);
      }

      const tableColumn = ['Alumno', 'Aula', 'Fecha/Hora', 'Descripción', 'Tipo'];
      const tableRows = filteredIncidents.map(inc => [
        inc.estudianteNombre || inc.alumno_asignado || 'Desconocido',
        inc.aulaId || 'N/A',
        inc.timestamp instanceof Date ? inc.timestamp.toLocaleString() : new Date(inc.timestamp).toLocaleString(),
        inc.descripcion || inc.urlIntentada || inc.url || '',
        inc.tipo || ''
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: (searchTerm || fechaInicio || fechaFin) ? 50 : 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [249, 115, 22] }
      });

      doc.save(`incidencias_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
    } finally {
      setExportando(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0f1117] border border-white/5 rounded-3xl p-10 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-orange-500 font-black text-[10px] uppercase tracking-widest">CARGANDO INCIDENCIAS...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header con título y botón de filtros */}
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
        <div>
          <h2 className="text-lg font-black italic text-white uppercase flex items-center gap-2">
            <ShieldAlert className="text-orange-500 w-5 h-5" /> Registro de Infracciones
          </h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Monitoreo de seguridad EDU • {filteredIncidents.length} de {incidents.length} eventos
          </p>
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)} 
          className="text-slate-400 hover:text-white text-[10px] font-black uppercase flex items-center gap-1 transition-colors"
        >
          <Calendar size={14} /> Filtros
        </button>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="p-4 bg-slate-900/50 border-b border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Buscar alumno o aula..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-8 pr-3 text-white text-xs outline-none focus:border-orange-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-xs"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                placeholder="Fecha inicio"
              />
            </div>
            <div>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-xs"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                placeholder="Fecha fin"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleShare}
                disabled={filteredIncidents.length === 0}
                className="bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-600/20 px-3 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all disabled:opacity-50"
                title="Compartir"
              >
                <Share2 size={12} /> Compartir
              </button>
              <button
                onClick={generatePDF}
                disabled={exportando || filteredIncidents.length === 0}
                className="bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white border border-orange-600/20 px-3 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Download size={12} /> {exportando ? 'PDF...' : 'PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de incidencias */}
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
        {filteredIncidents.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldAlert className="w-12 h-12 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-600 font-black uppercase text-[10px] tracking-widest">
              No hay incidencias con los filtros seleccionados
            </p>
          </div>
        ) : (
          filteredIncidents.map((inc: any) => (
            <div 
              key={inc.id} 
              className={`p-5 flex items-center justify-between transition-all ${
                inc.status === 'visto' ? 'opacity-40 bg-slate-900/20' : 'bg-orange-500/5 hover:bg-orange-500/10'
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-3 rounded-2xl ${
                  inc.status === 'visto' ? 'bg-slate-800' : 'bg-orange-500/20'
                }`}>
                  {inc.tipo?.includes('URL') || inc.url ? (
                    <Globe className={`w-5 h-5 ${inc.status === 'visto' ? 'text-slate-500' : 'text-orange-500'}`} />
                  ) : (
                    <Monitor className={`w-5 h-5 ${inc.status === 'visto' ? 'text-slate-500' : 'text-orange-500'}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-black text-sm uppercase">
                      {inc.estudianteNombre || inc.alumno_asignado || 'ALUMNO'}
                    </p>
                    {inc.deviceId && (
                      <span className="text-[8px] font-mono text-slate-600">
                        {inc.deviceId}
                      </span>
                    )}
                  </div>
                  {/* NUEVO: Aula y Sección */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                      Aula: {inc.aulaId || 'N/A'}
                    </span>
                    {inc.seccion && (
                      <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                        Sección: {inc.seccion}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs font-medium italic mb-1">
                    {inc.descripcion || inc.urlIntentada || inc.url || 'Intento de acceso bloqueado'}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-slate-600 flex items-center gap-1 font-bold">
                      <Clock className="w-3 h-3" /> 
                      {inc.timestamp ? new Date(inc.timestamp).toLocaleString() : 'RECIENTE'}
                    </span>
                    {inc.tipo && (
                      <span className="text-[8px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">
                        {inc.tipo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 ml-4">
                {/* Botón de historial (globo) */}
                {onViewHistory && inc.deviceId && (
                  <Button
                    onClick={() => onViewHistory(inc.deviceId, inc.estudianteNombre || inc.alumno_asignado || 'Estudiante')}
                    variant="ghost"
                    size="icon"
                    className="text-slate-500 hover:text-blue-500 h-8 w-8"
                    title="Ver historial de navegación"
                  >
                    <History size={14} />
                  </Button>
                )}
                {/* Botón de mensaje (notificación) */}
                {onSendMessage && inc.deviceId && (
                  <Button
                    onClick={() => onSendMessage(inc.deviceId, inc.estudianteNombre || inc.alumno_asignado || 'Estudiante')}
                    variant="ghost"
                    size="icon"
                    className="text-slate-500 hover:text-green-500 h-8 w-8"
                    title="Enviar notificación al alumno"
                  >
                    <MessageSquare size={14} />
                  </Button>
                )}
                {inc.status !== 'visto' && (
                  <Button 
                    onClick={() => markAsResolved(inc.id)}
                    className="bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white text-[10px] font-black rounded-xl h-8 px-3 border border-orange-600/20"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    VISTO
                  </Button>
                )}
                <Button 
                  onClick={() => deleteIncident(inc.id)}
                  variant="ghost"
                  size="icon"
                  className="text-slate-700 hover:text-red-500 h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}