'use client';
import React, { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { X, Globe, Clock, ExternalLink, ShieldAlert, Download, Share2, Calendar, Search, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WebHistory {
  id: string;
  url: string;
  timestamp: any; // Firestore Timestamp o Date
}

interface WebHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabletId: string;
  alumnoNombre: string;
}

export function WebHistoryModal({ isOpen, onClose, tabletId, alumnoNombre }: WebHistoryModalProps) {
  const [history, setHistory] = useState<WebHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<WebHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Fechas temporales y aplicadas
  const [tempFechaInicio, setTempFechaInicio] = useState<string>('');
  const [tempFechaFin, setTempFechaFin] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !tabletId) return;

    setLoading(true);
    setError(null);
    console.log("WebHistoryModal: tabletId =", tabletId);

    const q = query(
      collection(db, 'web_history'),
      where('deviceId', '==', tabletId),
      orderBy('timestamp', 'desc'),
      limit(20) // Podemos quitar el límite si usamos filtros
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WebHistory[];
      setHistory(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando historial:", error);
      setError(error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, tabletId]);

  // Aplicar filtros de fecha
  useEffect(() => {
    let filtrados = history;

    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      filtrados = filtrados.filter(item => {
        const fecha = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
        return fecha >= inicio;
      });
    }
    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      filtrados = filtrados.filter(item => {
        const fecha = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
        return fecha <= fin;
      });
    }

    setFilteredHistory(filtrados);
  }, [history, fechaInicio, fechaFin]);

  const handleBuscar = () => {
    setFechaInicio(tempFechaInicio);
    setFechaFin(tempFechaFin);
    setShowFilters(false); // Opcional: cerrar filtros tras buscar
  };

  const handleLimpiarHistorial = async () => {
    if (!confirm(`¿Estás seguro de eliminar todo el historial de navegación de ${alumnoNombre}?`)) return;
    try {
      const q = query(collection(db, 'web_history'), where('deviceId', '==', tabletId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      // El onSnapshot actualizará la lista automáticamente
    } catch (error) {
      console.error("Error eliminando historial:", error);
      alert("No se pudo eliminar el historial. Verifica permisos.");
    }
  };

  const handleShare = async () => {
    if (!navigator.share) {
      alert('La función de compartir no está disponible en este navegador.');
      return;
    }

    const text = `Historial de navegación de ${alumnoNombre}${
      fechaInicio || fechaFin ? ` (${fechaInicio || ''} - ${fechaFin || ''})` : ''
    }:\n` + 
      filteredHistory.map(h => `${h.timestamp?.toDate().toLocaleString()} - ${h.url}`).join('\n');

    try {
      await navigator.share({
        title: `Historial de ${alumnoNombre}`,
        text: text,
      });
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Historial de Navegación', 14, 20);
    doc.setFontSize(10);
    doc.text(`Alumno: ${alumnoNombre}`, 14, 30);
    doc.text(`Dispositivo: ${tabletId}`, 14, 36);
    doc.text(`Fecha generación: ${new Date().toLocaleDateString()}`, 14, 42);
    if (fechaInicio || fechaFin) {
      doc.text(`Período: ${fechaInicio || 'sin inicio'} - ${fechaFin || 'sin fin'}`, 14, 48);
    }

    const tableData = filteredHistory.map(h => [
      h.timestamp?.toDate().toLocaleString() || '',
      h.url
    ]);

    autoTable(doc, {
      startY: fechaInicio || fechaFin ? 55 : 50,
      head: [['Fecha/Hora', 'URL']],
      body: tableData,
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 'auto' } }
    });

    doc.save(`historial_${alumnoNombre}_${tabletId}.pdf`);
  };

  if (!isOpen) return null;

  const displayHistory = (fechaInicio || fechaFin) ? filteredHistory : history;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d23] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Globe className="text-orange-500 w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight">Historial de Navegación</h3>
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Alumno: {alumnoNombre}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Filtros por fecha"
            >
              <Calendar size={18} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="p-4 bg-slate-900/50 border-b border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[8px] text-slate-500 uppercase block mb-1">Fecha inicio</label>
                <input
                  type="date"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-xs"
                  value={tempFechaInicio}
                  onChange={(e) => setTempFechaInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[8px] text-slate-500 uppercase block mb-1">Fecha fin</label>
                <input
                  type="date"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-xs"
                  value={tempFechaFin}
                  onChange={(e) => setTempFechaFin(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleBuscar}
                  className="flex-1 bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all"
                >
                  <Search size={12} /> Buscar
                </button>
                <button
                  onClick={handleLimpiarHistorial}
                  className="flex-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all"
                >
                  <Trash2 size={12} /> Limpiar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-sm">Consultando Centinela...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-slate-400 font-medium">Error al cargar historial</p>
              <p className="text-slate-600 text-xs mt-1">{error}</p>
              <p className="text-slate-600 text-xs mt-2">tabletId: {tabletId}</p>
            </div>
          ) : displayHistory.length > 0 ? (
            <div className="space-y-3">
              {displayHistory.map((item) => (
                <div key={item.id} className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:text-orange-500 group-hover:bg-orange-500/10 transition-colors">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm text-slate-200 font-medium truncate group-hover:text-white">{item.url}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="w-12 h-12 text-slate-700 mb-4" />
              <p className="text-slate-400 font-medium">No se detectaron registros recientes.</p>
              <p className="text-slate-600 text-xs mt-1">El sistema Centinela no ha reportado actividad para este dispositivo.</p>
              <p className="text-slate-600 text-xs mt-2">tabletId: {tabletId}</p>
            </div>
          )}
        </div>

        {/* Footer con botones de acción */}
        <div className="p-4 bg-black/20 border-t border-white/5 flex justify-between items-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">EDUControlPro - Monitoreo</p>
          {displayHistory.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-lg text-[10px] font-black uppercase transition-colors"
              >
                <Share2 size={14} />
                Compartir
              </button>
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 px-3 py-2 bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white rounded-lg text-[10px] font-black uppercase transition-colors"
              >
                <Download size={14} />
                PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
