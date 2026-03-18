'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  ShieldAlert, Globe, Monitor, Trash2, Clock, CheckCircle, MessageSquare, History, 
  Search, Calendar, Download, Share2, Zap, AlertTriangle 
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
  const [loading, setLoading] = useState(true);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exportando, setExportando] = useState(false);

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
      console.error("Error EDUControlPro Alerts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId]);

  // Filtrado optimizado con useMemo
  const filteredIncidents = useMemo(() => {
    let filtradas = incidents;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtradas = filtradas.filter(inc => 
        (inc.estudianteNombre?.toLowerCase().includes(term)) ||
        (inc.alumno_asignado?.toLowerCase().includes(term)) ||
        (inc.aulaId?.toLowerCase().includes(term))
      );
    }

    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      filtradas = filtradas.filter(inc => new Date(inc.timestamp) >= inicio);
    }

    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      filtradas = filtradas.filter(inc => new Date(inc.timestamp) <= fin);
    }

    return filtradas;
  }, [incidents, searchTerm, fechaInicio, fechaFin]);

  // Resumen Estadístico (Valor agregado)
  const stats = useMemo(() => {
    const pendientes = incidents.filter(i => i.status !== 'visto').length;
    const hoy = incidents.filter(inc => {
      const d = new Date(inc.timestamp);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    }).length;
    return { pendientes, hoy };
  }, [incidents]);

  const markAsResolved = async (id: string) => {
    try {
      await updateDoc(doc(db, "alertas", id), {
        status: 'visto',
        resolvedAt: new Date()
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const deleteIncident = async (id: string) => {
    if (!confirm("¿Desea eliminar permanentemente este registro del sistema?")) return;
    try {
      await deleteDoc(doc(db, "alertas", id));
    } catch (error) {
      console.error("Error deleting incident:", error);
    }
  };

  const generatePDF = () => {
    if (filteredIncidents.length === 0) return;
    setExportando(true);
    const docPdf = new jsPDF();
    
    docPdf.setFillColor(15, 17, 23);
    docPdf.rect(0, 0, 210, 25, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(16);
    docPdf.text('REPORTE CRÍTICO DE INCIDENCIAS', 14, 15);
    
    const tableRows = filteredIncidents.map(inc => [
      inc.estudianteNombre || inc.alumno_asignado || 'N/A',
      inc.aulaId || '-',
      new Date(inc.timestamp).toLocaleString(),
      inc.descripcion || inc.urlIntentada || 'Bloqueo Genérico',
      inc.tipo || 'SISTEMA'
    ]);

    autoTable(docPdf, {
      head: [['Alumno', 'Aula', 'Fecha/Hora', 'Detalle', 'Categoría']],
      body: tableRows,
      startY: 35,
      headStyles: { fillColor: [249, 115, 22] },
      styles: { fontSize: 7 }
    });

    docPdf.save(`EFAS_Incidencias_${new Date().getTime()}.pdf`);
    setExportando(false);
  };

  if (loading) return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-16 text-center shadow-2xl">
      <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-6"></div>
      <p className="text-orange-500 font-black text-[11px] uppercase tracking-[0.3em] italic">Sincronizando con Centinela...</p>
    </div>
  );

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
      
      {/* Header Corporativo con Stats */}
      <div className="p-8 border-b border-white/5 bg-gradient-to-br from-slate-900/50 to-transparent flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-3">
            <ShieldAlert className="text-orange-500 w-6 h-6 animate-pulse" /> Registro de <span className="text-orange-500 underline">Infracciones</span>
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <Zap size={12} className="text-orange-500" /> {incidents.length} Eventos totales
            </div>
            {stats.pendientes > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                <AlertTriangle size={12} /> {stats.pendientes} Pendientes
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
            <Button 
                onClick={() => setShowFilters(!showFilters)} 
                variant="outline"
                className="bg-slate-900 border-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter"
            >
                <Calendar size={14} className="mr-2" /> {showFilters ? 'Cerrar Filtros' : 'Filtrar Datos'}
            </Button>
            <Button onClick={generatePDF} disabled={exportando} className="bg-orange-500 hover:bg-orange-600 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-500/20">
                <Download size={14} className="mr-2" /> {exportando ? 'Exportando...' : 'PDF'}
            </Button>
        </div>
      </div>

      {/* Panel de Filtros Animado */}
      {showFilters && (
        <div className="p-6 bg-slate-900/30 border-b border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top duration-300">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="BUSCAR ALUMNO O AULA..."
              className="w-full bg-slate-950 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white text-[10px] font-bold uppercase outline-none focus:border-orange-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <input type="date" className="bg-slate-950 border border-white/5 rounded-2xl py-3 px-4 text-white text-xs uppercase" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          <input type="date" className="bg-slate-950 border border-white/5 rounded-2xl py-3 px-4 text-white text-xs uppercase" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
      )}

      {/* Lista de Registros */}
      <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar bg-slate-950/20">
        {filteredIncidents.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-white/5">
                <ShieldAlert className="w-8 h-8 text-slate-700" />
            </div>
            <p className="text-slate-600 font-black uppercase text-[10px] tracking-[0.2em]">
              Zona Segura: No se detectan anomalías
            </p>
          </div>
        ) : (
          filteredIncidents.map((inc: any) => (
            <div 
              key={inc.id} 
              className={`p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:bg-white/[0.02] ${
                inc.status === 'visto' ? 'opacity-40 grayscale' : 'border-l-4 border-l-orange-500 bg-orange-500/[0.02]'
              }`}
            >
              <div className="flex items-center gap-5 flex-1">
                <div className={`p-4 rounded-2xl shadow-inner ${
                  inc.status === 'visto' ? 'bg-slate-900' : 'bg-orange-500/10 border border-orange-500/20'
                }`}>
                  {inc.tipo?.includes('URL') || inc.url ? (
                    <Globe className={`w-5 h-5 ${inc.status === 'visto' ? 'text-slate-500' : 'text-orange-500'}`} />
                  ) : (
                    <Monitor className={`w-5 h-5 ${inc.status === 'visto' ? 'text-slate-500' : 'text-orange-500'}`} />
                  )}
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-black text-sm uppercase italic tracking-tighter">
                      {inc.estudianteNombre || inc.alumno_asignado || 'AGENTE DESCONOCIDO'}
                    </p>
                    <span className="text-[9px] bg-slate-900 px-2 py-0.5 rounded-lg border border-white/5 text-slate-500 font-mono">
                      {inc.deviceId?.substring(0, 12)}...
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1.5 mb-2">
                    <span className="text-[8px] font-black text-orange-500/70 uppercase">Aula: {inc.aulaId || 'EXTERN'}</span>
                    <span className="text-slate-700">•</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">
                        {inc.timestamp ? new Date(inc.timestamp).toLocaleString() : 'JUSTO AHORA'}
                    </span>
                  </div>

                  <p className="text-slate-400 text-xs font-bold leading-relaxed truncate max-w-md">
                    {inc.descripcion || inc.urlIntentada || inc.url || 'INTENTO DE VIOLACIÓN DE PROTOCOLO'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end bg-slate-950/50 p-2 sm:bg-transparent rounded-xl">
                {onViewHistory && (
                  <Button onClick={() => onViewHistory(inc.deviceId, inc.estudianteNombre || inc.alumno_asignado)} variant="ghost" size="icon" className="text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl" title="Historial">
                    <History size={18} />
                  </Button>
                )}
                {onSendMessage && (
                  <Button onClick={() => onSendMessage(inc.deviceId, inc.estudianteNombre || inc.alumno_asignado)} variant="ghost" size="icon" className="text-slate-500 hover:text-green-500 hover:bg-green-500/10 rounded-xl" title="Notificar">
                    <MessageSquare size={18} />
                  </Button>
                )}
                
                <div className="h-6 w-[1px] bg-white/5 mx-1 hidden sm:block" />

                {inc.status !== 'visto' && (
                  <Button 
                    onClick={() => markAsResolved(inc.id)}
                    className="bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white text-[10px] font-black rounded-xl h-9 px-4 border border-orange-500/20 transition-all"
                  >
                    <CheckCircle className="w-3 h-3 mr-2" /> VISTO
                  </Button>
                )}
                
                <Button 
                  onClick={() => deleteIncident(inc.id)}
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-950/50 border-t border-white/5 flex justify-center">
            <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] italic">
                EFAS ServiControl v2.4 • Sistema de Control Parental Educativo
            </p>
      </div>
    </div>
  );
}