'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot, deleteDoc, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { X, Globe, Clock, ExternalLink, ShieldAlert, Download, Calendar, Search, Trash2, Zap, Shield } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WebHistory {
  id: string;
  url: string;
  timestamp: any;
}

interface WebHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabletId: string;
  alumnoNombre: string;
}

export function WebHistoryModal({ isOpen, onClose, tabletId, alumnoNombre }: WebHistoryModalProps) {
  const [history, setHistory] = useState<WebHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [blockingUrl, setBlockingUrl] = useState<string | null>(null);
  
  const [tempFechaInicio, setTempFechaInicio] = useState<string>('');
  const [tempFechaFin, setTempFechaFin] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !tabletId) return;
    setLoading(true);

    const q = query(
      collection(db, 'web_history'),
      where('deviceId', '==', tabletId),
      orderBy('timestamp', 'desc'),
      limit(100) 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WebHistory[];
      setHistory(docs);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, tabletId]);

  const filteredHistory = useMemo(() => {
    let result = history;
    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      result = result.filter(item => {
        const fecha = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
        return fecha >= inicio;
      });
    }
    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      result = result.filter(item => {
        const fecha = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
        return fecha <= fin;
      });
    }
    return result;
  }, [history, fechaInicio, fechaFin]);

  // FUNCIÓN CRÍTICA: Bloqueo de Dominio Directo
  const handleBlockDomain = async (rawUrl: string) => {
    try {
      setBlockingUrl(rawUrl);
      // Extraer dominio (ej: youtube.com)
      const domain = new URL(rawUrl).hostname.replace('www.', '');
      
      const blockRef = doc(db, 'blocked_domains', domain);
      await setDoc(blockRef, {
        domain: domain,
        addedBy: 'Admin_Centinela',
        timestamp: serverTimestamp(),
        reason: `Bloqueado desde historial de ${alumnoNombre}`,
        active: true
      });

      alert(`Dominio ${domain} ha sido añadido a la Lista Negra Global.`);
    } catch (err) {
      console.error("Error al bloquear:", err);
      alert("No se pudo procesar el bloqueo del dominio.");
    } finally {
      setBlockingUrl(null);
    }
  };

  const handleBuscar = () => {
    setFechaInicio(tempFechaInicio);
    setFechaFin(tempFechaFin);
  };

  const generatePDF = () => {
    const docPdf = new jsPDF();
    docPdf.setFillColor(15, 17, 23);
    docPdf.rect(0, 0, 210, 20, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.text('REPORTE DE NAVEGACIÓN - EDUControlPro', 14, 13);
    
    const tableData = filteredHistory.map(h => [
      h.timestamp?.toDate ? h.timestamp.toDate().toLocaleString() : new Date(h.timestamp).toLocaleString(),
      h.url
    ]);

    autoTable(docPdf, {
      startY: 50,
      head: [['Timestamp', 'URL Destino']],
      body: tableData,
      headStyles: { fillColor: [249, 115, 22] },
      styles: { fontSize: 7 }
    });

    docPdf.save(`Log_${alumnoNombre}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0f1117] border border-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-gradient-to-br from-slate-900 to-transparent">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Globe className="text-orange-500 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Historial <span className="text-orange-500">Web</span></h3>
              <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mt-1">Agente: {alumnoNombre}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className={`p-3 rounded-xl transition-all ${showFilters ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
              <Calendar size={20} />
            </button>
            <button onClick={onClose} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Panel de Filtros */}
        {showFilters && (
          <div className="p-6 bg-slate-900/50 border-b border-slate-800 animate-in slide-in-from-top duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-white">
              <input type="date" className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs" value={tempFechaInicio} onChange={(e) => setTempFechaInicio(e.target.value)} />
              <input type="date" className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs" value={tempFechaFin} onChange={(e) => setTempFechaFin(e.target.value)} />
              <button onClick={handleBuscar} className="bg-orange-500 hover:bg-orange-600 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                <Search size={14} /> Filtrar
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[50vh] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Consultando Centinela...</p>
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <div key={item.id} className="group p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 hover:border-orange-500/40 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-5 overflow-hidden">
                    <div className="p-3 rounded-xl bg-slate-950 text-slate-500 group-hover:text-orange-500 transition-all">
                      <Clock size={16} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm text-slate-200 font-bold truncate italic tracking-tight">{item.url}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* ACCIONES: Bloqueo y Link */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleBlockDomain(item.url)}
                      disabled={blockingUrl === item.url}
                      className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all"
                      title="Bloquear este sitio"
                    >
                      {blockingUrl === item.url ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Shield size={16} />}
                    </button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-slate-950 rounded-xl text-slate-500 hover:text-orange-500 border border-slate-800 transition-all">
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center opacity-40">
              <ShieldAlert size={48} className="mx-auto mb-4 text-slate-700" />
              <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Estatus: Centinela Silencioso</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">EFAS ServiControl v2.4</p>
          <button onClick={generatePDF} className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-orange-500/10">
            <Download size={14} /> Reporte PDF
          </button>
        </div>
      </div>
    </div>
  );
}
