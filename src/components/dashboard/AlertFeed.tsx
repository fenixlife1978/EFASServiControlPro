'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/firebase/config';
import { 
  collection, query, where, orderBy, onSnapshot, 
  Timestamp, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';
import { 
  ShieldAlert, Clock, X, Search, Calendar, Download, Trash2, CheckCircle 
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
  timestamp?: Timestamp | Date | string;
  tipo?: string;
  status?: string; // 'nuevo', 'visto'
  deviceId?: string;
}

interface AlertFeedProps {
  aulaId: string;
  institutoId: string;
}

export function AlertFeed({ aulaId, institutoId }: AlertFeedProps) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [filteredAlertas, setFilteredAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
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
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
      })) as Alerta[];
      setAlertas(data);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando alertas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutoId]);

  // Aplicar filtros cada vez que cambien las alertas o los filtros
  useEffect(() => {
    let filtradas = alertas;

    // Filtrar por aula (si se proporciona)
    if (aulaId) {
      filtradas = filtradas.filter(a => !a.aulaId || a.aulaId === aulaId);
    }

    // Filtrar por término de búsqueda (nombre del alumno)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtradas = filtradas.filter(a => 
        (a.estudianteNombre?.toLowerCase().includes(term)) ||
        (a.alumno_asignado?.toLowerCase().includes(term))
      );
    }

    // Filtrar por rango de fechas
    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      filtradas = filtradas.filter(a => {
        const fecha = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp as any);
        return fecha >= inicio;
      });
    }
    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      filtradas = filtradas.filter(a => {
        const fecha = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp as any);
        return fecha <= fin;
      });
    }

    setFilteredAlertas(filtradas);
  }, [alertas, searchTerm, fechaInicio, fechaFin, aulaId]);

  const handleMarcarVistas = async () => {
    // Marcar todas las alertas filtradas como vistas
    const promises = filteredAlertas
      .filter(a => a.status !== 'visto')
      .map(a => updateDoc(doc(db, 'alertas', a.id), { status: 'visto' }));
    await Promise.all(promises);
  };

  const handleEliminarTodas = async () => {
    if (!confirm('¿Eliminar permanentemente todas las alertas filtradas?')) return;
    const promises = filteredAlertas.map(a => deleteDoc(doc(db, 'alertas', a.id)));
    await Promise.all(promises);
  };

  const exportarPDF = () => {
    setExportando(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Reporte de Alertas', 14, 22);
      doc.setFontSize(11);
      doc.text(`Institución: ${institutoId}`, 14, 32);
      if (aulaId) doc.text(`Aula: ${aulaId}`, 14, 38);
      if (fechaInicio || fechaFin) {
        let fechaTexto = 'Fechas: ';
        if (fechaInicio) fechaTexto += `desde ${new Date(fechaInicio).toLocaleDateString()}`;
        if (fechaFin) fechaTexto += ` hasta ${new Date(fechaFin).toLocaleDateString()}`;
        doc.text(fechaTexto, 14, 44);
      }

      const tableColumn = ['Alumno', 'Fecha/Hora', 'Descripción', 'Tipo'];
      const tableRows = filteredAlertas.map(a => [
        a.estudianteNombre || a.alumno_asignado || 'Desconocido',
        a.timestamp instanceof Date ? a.timestamp.toLocaleString() : new Date(a.timestamp as any).toLocaleString(),
        a.descripcion || a.urlIntentada || a.url || '',
        a.tipo || ''
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: fechaInicio || fechaFin ? 50 : 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [249, 115, 22] }
      });

      doc.save(`alertas_${institutoId}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (error) {
      console.error('Error exportando PDF:', error);
    } finally {
      setExportando(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0f1117] border border-slate-800 rounded-2xl p-8 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-500 text-[10px] uppercase">Cargando alertas...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="text-white font-black uppercase italic text-sm flex items-center gap-2">
          <ShieldAlert className="text-orange-500" size={18} />
          Alertas de Seguridad ({filteredAlertas.length})
        </h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-slate-400 hover:text-white text-[10px] font-black uppercase flex items-center gap-1"
        >
          <Calendar size={14} /> Filtros
        </button>
      </div>

      {showFilters && (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar alumno..."
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
          <div className="flex gap-2 col-span-full justify-end">
            <button
              onClick={handleMarcarVistas}
              className="bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-600/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all"
            >
              <CheckCircle size={12} /> Marcar vistas
            </button>
            <button
              onClick={handleEliminarTodas}
              className="bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all"
            >
              <Trash2 size={12} /> Limpiar
            </button>
            <button
              onClick={exportarPDF}
              disabled={exportando}
              className="bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white border border-orange-600/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all disabled:opacity-50"
            >
              <Download size={12} /> {exportando ? 'Exportando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredAlertas.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-[10px] uppercase">
            No hay alertas con los filtros seleccionados.
          </div>
        ) : (
          filteredAlertas.map((alerta) => (
            <div
              key={alerta.id}
              className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                alerta.status === 'visto'
                  ? 'bg-slate-900/30 border-slate-800/50 opacity-60'
                  : 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                alerta.status === 'visto' ? 'bg-slate-800' : 'bg-orange-500/20'
              }`}>
                <ShieldAlert size={16} className={alerta.status === 'visto' ? 'text-slate-500' : 'text-orange-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <p className="text-white font-black text-xs uppercase truncate">
                    {alerta.estudianteNombre || alerta.alumno_asignado || 'Desconocido'}
                  </p>
                  <span className="text-[8px] text-slate-500 font-mono">
                    {alerta.timestamp instanceof Date
                      ? alerta.timestamp.toLocaleString()
                      : new Date(alerta.timestamp as any).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-400 text-[9px] leading-tight mt-1 break-all">
                  {alerta.descripcion || alerta.urlIntentada || alerta.url || 'Intento bloqueado'}
                </p>
                {alerta.tipo && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-slate-800 rounded-full text-[8px] font-bold text-slate-400 uppercase">
                    {alerta.tipo}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
