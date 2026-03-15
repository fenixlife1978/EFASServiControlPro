'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { 
  collection, query, where, orderBy, onSnapshot, 
  Timestamp, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';
import { 
  ShieldAlert, Clock, X, Search, Calendar, Download, Trash2, CheckCircle, Filter
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Alerta {
  id: string;
  InstitutoId: string;
  aulaId?: string | null;
  estudianteNombre?: string;
  alumno_asignado?: string;
  descripcion?: string;
  url?: string;
  urlIntentada?: string;
  timestamp?: any;
  tipo?: string;
  status?: string; // 'nuevo', 'visto'
  deviceId?: string;
}

interface AlertFeedProps {
  aulaId?: string;
  institutoId: string;
}

export function AlertFeed({ aulaId, institutoId }: AlertFeedProps) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [filteredAlertas, setFilteredAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFechaInicio, setTempFechaInicio] = useState<string>('');
  const [tempFechaFin, setTempFechaFin] = useState<string>('');
  
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedFechaInicio, setAppliedFechaInicio] = useState<string>('');
  const [appliedFechaFin, setAppliedFechaFin] = useState<string>('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    if (!institutoId) return;

    const q = query(
      collection(db, "alertas"),
      where("InstitutoId", "==", institutoId),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        // Normalización de fecha robusta
        let ts = d.timestamp;
        if (ts instanceof Timestamp) ts = ts.toDate();
        else if (typeof ts === 'string') ts = new Date(ts);
        
        return { id: doc.id, ...d, timestamp: ts };
      }) as Alerta[];
      
      setAlertas(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutoId]);

  useEffect(() => {
    let filtradas = [...alertas];

    if (aulaId) {
      filtradas = filtradas.filter(a => a.aulaId === aulaId);
    }

    if (appliedSearchTerm) {
      const term = appliedSearchTerm.toLowerCase();
      filtradas = filtradas.filter(a => 
        (a.estudianteNombre?.toLowerCase().includes(term)) ||
        (a.alumno_asignado?.toLowerCase().includes(term))
      );
    }

    if (appliedFechaInicio) {
      const inicio = new Date(appliedFechaInicio);
      inicio.setHours(0, 0, 0, 0);
      filtradas = filtradas.filter(a => a.timestamp >= inicio);
    }
    if (appliedFechaFin) {
      const fin = new Date(appliedFechaFin);
      fin.setHours(23, 59, 59, 999);
      filtradas = filtradas.filter(a => a.timestamp <= fin);
    }

    setFilteredAlertas(filtradas);
  }, [alertas, appliedSearchTerm, appliedFechaInicio, appliedFechaFin, aulaId]);

  const handleBuscar = () => {
    setAppliedSearchTerm(tempSearchTerm);
    setAppliedFechaInicio(tempFechaInicio);
    setAppliedFechaFin(tempFechaFin);
  };

  const handleMarcarVistas = async () => {
    const targets = filteredAlertas.filter(a => a.status !== 'visto');
    if (targets.length === 0) return;
    
    const promises = targets.map(a => updateDoc(doc(db, 'alertas', a.id), { status: 'visto' }));
    await Promise.all(promises);
  };

  const handleEliminarTodas = async () => {
    if (!confirm('¿CONFIRMAR ELIMINACIÓN PERMANENTE DE ESTAS ALERTAS?')) return;
    const promises = filteredAlertas.map(a => deleteDoc(doc(db, 'alertas', a.id)));
    await Promise.all(promises);
  };

  const exportarPDF = () => {
    setExportando(true);
    try {
      const doc = new jsPDF();
      
      // Header Estilo EDUControlPro
      doc.setFillColor(15, 17, 23);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text('EDUCONTROLPRO - SECURITY LOGS', 15, 20);
      
      doc.setFontSize(8);
      doc.setTextColor(249, 115, 22);
      doc.text(`REPORTE DE INCIDENCIAS GENERADO EL: ${new Date().toLocaleString()}`, 15, 28);

      const tableColumn = ['ESTUDIANTE', 'FECHA / HORA', 'INCIDENCIA / URL', 'TIPO'];
      const tableRows = filteredAlertas.map(a => [
        (a.estudianteNombre || a.alumno_asignado || 'N/A').toUpperCase(),
        a.timestamp?.toLocaleString() || '---',
        a.descripcion || a.urlIntentada || a.url || 'Bloqueo Genérico',
        (a.tipo || 'SECURITY').toUpperCase()
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 7, font: 'helvetica' },
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });

      doc.save(`Alertas_EDU_${institutoId}.pdf`);
    } catch (error) {
      console.error(error);
    } finally {
      setExportando(false);
    }
  };

  if (loading) return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-[2rem] p-12 text-center animate-pulse">
      <ShieldAlert className="mx-auto text-slate-700 mb-4" size={32} />
      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">Sincronizando Feed de Seguridad...</p>
    </div>
  );

  return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
      {/* Luces de estado en el fondo */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[80px] -z-10" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-white font-black uppercase italic text-lg flex items-center gap-3 tracking-tighter">
            <ShieldAlert className="text-orange-500" size={24} />
            Alertas de <span className="text-orange-500">Seguridad</span>
          </h3>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Registros de actividad bloqueada en tiempo real</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 transition-all border ${
              showFilters ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Filter size={14} /> {showFilters ? 'Cerrar Filtros' : 'Filtrar'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-black/40 p-5 rounded-3xl border border-slate-800 mb-6 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Buscar Alumno</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <input
                  type="text"
                  placeholder="NOMBRE DEL ESTUDIANTE..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white text-[10px] font-bold uppercase outline-none focus:border-orange-500"
                  value={tempSearchTerm}
                  onChange={(e) => setTempSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Fecha Desde</label>
              <input
                type="date"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-[10px] font-bold outline-none focus:border-orange-500"
                value={tempFechaInicio}
                onChange={(e) => setTempFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">Fecha Hasta</label>
              <input
                type="date"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-[10px] font-bold outline-none focus:border-orange-500"
                value={tempFechaFin}
                onChange={(e) => setTempFechaFin(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-between items-center border-t border-slate-800 pt-4">
            <div className="flex gap-2">
              <button onClick={handleMarcarVistas} className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white border border-blue-500/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all">
                Visto
              </button>
              <button onClick={handleEliminarTodas} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all">
                Limpiar Feed
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={exportarPDF} disabled={exportando} className="bg-white text-black hover:bg-orange-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2">
                <Download size={14} /> {exportando ? '...' : 'PDF'}
              </button>
              <button onClick={handleBuscar} className="bg-orange-500 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all">
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredAlertas.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-[2rem]">
            <CheckCircle className="mx-auto text-slate-800 mb-2" size={32} />
            <p className="text-slate-600 text-[9px] font-black uppercase italic tracking-[0.2em]">Cero incidencias detectadas</p>
          </div>
        ) : (
          filteredAlertas.map((alerta) => (
            <div
              key={alerta.id}
              className={`group p-4 rounded-2xl border flex items-start gap-4 transition-all duration-300 ${
                alerta.status === 'visto'
                  ? 'bg-black/20 border-slate-800/40 opacity-50 grayscale'
                  : 'bg-slate-900/50 border-slate-800 hover:border-orange-500/50 hover:bg-orange-500/[0.02]'
              }`}
            >
              <div className={`p-3 rounded-xl shrink-0 ${
                alerta.status === 'visto' ? 'bg-slate-800 text-slate-600' : 'bg-orange-500/10 text-orange-500'
              }`}>
                <ShieldAlert size={20} className={alerta.status !== 'visto' ? 'animate-pulse' : ''} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-white font-black text-[11px] uppercase italic tracking-tight truncate">
                    {alerta.estudianteNombre || alerta.alumno_asignado || 'DISPOSITIVO SIN ASIGNAR'}
                  </h4>
                  <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap bg-black/50 px-2 py-1 rounded-md">
                    {alerta.timestamp?.toLocaleString()}
                  </span>
                </div>
                
                <p className="text-slate-400 text-[10px] font-medium leading-relaxed break-all line-clamp-2 mb-2">
                  {alerta.descripcion || alerta.urlIntentada || alerta.url || 'INTENTO DE ACCESO NO AUTORIZADO'}
                </p>
                
                <div className="flex gap-2 items-center">
                  <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md text-[7px] font-black uppercase tracking-widest">
                    {alerta.tipo || 'CIPA_VIOLATION'}
                  </span>
                  {alerta.aulaId && (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md text-[7px] font-black uppercase tracking-widest">
                      AULA: {alerta.aulaId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
