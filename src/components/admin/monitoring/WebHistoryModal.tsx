'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { db, rtdb, auth } from '@/firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ref, onValue, set, serverTimestamp as rtdbTimestamp, push, get } from 'firebase/database';
import { X, Globe, Clock, ExternalLink, ShieldAlert, Download, Calendar, Search, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAuth } from 'firebase/auth';

interface WebHistory {
  id: string;
  url: string;
  timestamp: number;
  bloqueada: boolean;
  tipo?: string;
}

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
}

interface WebHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  alumnoNombre: string;
  institutoId?: string;
}

export function WebHistoryModal({ isOpen, onClose, deviceId, alumnoNombre, institutoId }: WebHistoryModalProps) {
  const [history, setHistory] = useState<WebHistory[]>([]);
  const [alertas, setAlertas] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [blockingUrl, setBlockingUrl] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  const [tempFechaInicio, setTempFechaInicio] = useState<string>('');
  const [tempFechaFin, setTempFechaFin] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  // 1. Escuchar historial de navegación COMPLETO desde RTDB (todas las URLs, bloqueadas o no)
  useEffect(() => {
    if (!isOpen || !deviceId) return;
    setLoading(true);

    const historialRef = ref(rtdb, `historial_navegacion/${deviceId}`);
    
    const unsubscribe = onValue(historialRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const historyList: WebHistory[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            url: value.url || '',
            timestamp: value.timestamp || 0,
            bloqueada: value.bloqueada === true,
            tipo: value.bloqueada ? 'BLOQUEADA' : 'PERMITIDA'
          }))
          .filter(item => item.url && !item.url.includes('busca en google') && !item.url.includes('chrome://'))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setHistory(historyList);
      } else {
        setHistory([]);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error cargando historial:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, deviceId]);

  // 2. Escuchar alertas de seguridad para complementar
  useEffect(() => {
    if (!isOpen || !deviceId) return;

    const alertasRef = ref(rtdb, `alertas_seguridad`);
    
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const alertsList: SecurityAlert[] = Object.entries(data)
          .map(([key, value]: [string, any]) => ({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: value.deviceId || ''
          }))
          .filter(alert => alert.deviceId === deviceId)
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setAlertas(alertsList);
      } else {
        setAlertas([]);
      }
    }, (err) => {
      console.error("Error cargando alertas:", err);
    });

    return () => unsubscribe();
  }, [isOpen, deviceId]);

  // Filtrar por fechas
  const filteredHistory = useMemo(() => {
    let result = history;
    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      result = result.filter(item => item.timestamp >= inicio.getTime());
    }
    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      result = result.filter(item => item.timestamp <= fin.getTime());
    }
    return result;
  }, [history, fechaInicio, fechaFin]);

  // Mostrar solo últimas 20 o todas
  const displayHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 20);

  // Bloquear dominio
  const handleBlockDomain = async (rawUrl: string) => {
    try {
      setBlockingUrl(rawUrl);
      
      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;
      
      if (!currentUser) {
        alert("❌ No estás autenticado. Inicia sesión nuevamente.");
        setBlockingUrl(null);
        return;
      }
      
      console.log("🔒 Bloqueando dominio como:", currentUser.email);
      
      let domain = "";
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        domain = urlObj.hostname.replace('www.', '').toLowerCase();
      } catch (e) {
        domain = rawUrl.split('/')[0].replace('www.', '').toLowerCase();
      }

      if (!domain) throw new Error("URL Inválida");
      
      let instId = institutoId;
      if (!instId) {
        const dispositivoRef = ref(rtdb, `dispositivos/${deviceId}/InstitutoId`);
        const snapshot = await get(dispositivoRef);
        if (snapshot.exists()) {
          instId = snapshot.val();
        } else {
          instId = "P1-001";
        }
      }
      
      console.log("📚 InstitutoId para bloqueo:", instId);
      
      const rtdbKey = domain.replace(/\./g, '_');
      const dominioRef = ref(rtdb, `config/instituciones/${instId}/blacklist/${rtdbKey}`);
      await set(dominioRef, domain);
      
      const useBlacklistRef = ref(rtdb, `config/instituciones/${instId}/useBlacklist`);
      await set(useBlacklistRef, true);
      
      const shieldRef = ref(rtdb, `config/instituciones/${instId}/shieldModeGlobal`);
      const shieldSnapshot = await get(shieldRef);
      if (!shieldSnapshot.exists() || shieldSnapshot.val() !== true) {
        await set(shieldRef, true);
      }
      
      await push(ref(rtdb, 'alertas_seguridad'), {
        tipo: 'bloqueo_manual',
        detalle: `Dominio bloqueado manualmente: ${domain} - desde historial de ${alumnoNombre}`,
        deviceId: deviceId,
        timestamp: Date.now(),
        admin: currentUser.email,
        InstitutoId: instId
      });
      
      alert(`✅ Dominio ${domain} añadido a la Lista Negra de la sede.`);
    } catch (err) {
      console.error("Error al bloquear:", err);
      alert("❌ No se pudo procesar el bloqueo del dominio.");
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
    docPdf.setTextColor(0, 0, 0);
    
    const tableData = filteredHistory.map(h => [
      new Date(h.timestamp).toLocaleString(),
      h.url,
      h.bloqueada ? 'BLOQUEADA' : 'PERMITIDA'
    ]);

    let finalY = 50;
    
    autoTable(docPdf, {
      startY: finalY,
      head: [['Fecha/Hora', 'URL Visitada', 'Estado']],
      body: tableData,
      headStyles: { fillColor: [249, 115, 22] },
      styles: { fontSize: 7 },
      didDrawPage: (data) => {
        finalY = data.cursor?.y || finalY;
      }
    });

    const alertCount = alertas.length;
    const blockCount = history.filter(h => h.bloqueada).length;
    
    docPdf.text(`Resumen: ${blockCount} URLs bloqueadas, ${history.length} URLs totales, ${alertCount} alertas`, 14, finalY + 10);
    
    docPdf.save(`Historial_${alumnoNombre}_${new Date().toISOString().slice(0,10)}.pdf`);
    alert("✅ PDF generado correctamente");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0f1117] border border-slate-800 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-gradient-to-br from-slate-900 to-transparent">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Globe className="text-orange-500 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Historial <span className="text-orange-500">Web</span></h3>
              <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mt-1">Agente: {alumnoNombre}</p>
              <p className="text-[8px] text-slate-600 mt-1">
                {history.length} URLs visitadas | {history.filter(h => h.bloqueada).length} bloqueadas | {alertas.length} alertas
              </p>
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

        {/* Lista de Historial */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[60vh] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Cargando historial...</p>
            </div>
          ) : displayHistory.length > 0 ? (
            <div className="space-y-3">
              {displayHistory.map((item) => (
                <div 
                  key={item.id} 
                  className={`group p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    item.bloqueada 
                      ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/60' 
                      : 'bg-slate-900/40 border-slate-800/50 hover:border-orange-500/40'
                  }`}
                >
                  <div className="flex items-center gap-5 overflow-hidden flex-1">
                    <div className={`p-3 rounded-xl transition-all ${
                      item.bloqueada ? 'bg-red-500/20 text-red-500' : 'bg-slate-950 text-slate-500 group-hover:text-orange-500'
                    }`}>
                      {item.bloqueada ? <ShieldAlert size={16} /> : <Globe size={16} />}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className={`text-sm font-bold truncate italic tracking-tight ${
                        item.bloqueada ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {item.url}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] text-slate-500 font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full ${
                          item.bloqueada 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {item.bloqueada ? 'BLOQUEADA' : 'PERMITIDA'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!item.bloqueada && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleBlockDomain(item.url)}
                        disabled={blockingUrl === item.url}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all"
                        title="Bloquear este sitio"
                      >
                        {blockingUrl === item.url ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Shield size={16} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center opacity-40">
              <ShieldAlert size={48} className="mx-auto mb-4 text-slate-700" />
              <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Sin historial de navegación</p>
              <p className="text-[8px] text-slate-700 mt-2">No hay registros de URLs visitadas para este dispositivo</p>
            </div>
          )}
          
          {/* Botón Ver más */}
          {filteredHistory.length > 20 && !showAllHistory && (
            <div className="text-center mt-4">
              <button
                onClick={() => setShowAllHistory(true)}
                className="text-[10px] text-orange-500 hover:text-orange-400 font-black uppercase"
              >
                + Ver {filteredHistory.length - 20} registros más...
              </button>
            </div>
          )}
          
          {showAllHistory && filteredHistory.length > 20 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setShowAllHistory(false)}
                className="text-[10px] text-slate-500 hover:text-white font-black uppercase"
              >
                Mostrar menos
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">EFAS ServiControl v2.4</p>
          <button onClick={generatePDF} disabled={filteredHistory.length === 0} className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-orange-500/10">
            <Download size={14} /> Reporte PDF
          </button>
        </div>
      </div>
    </div>
  );
}
