'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db, rtdb, auth } from '@/firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ref, onValue, set, serverTimestamp as rtdbTimestamp, push, get, off } from 'firebase/database';
import { X, Globe, Clock, ExternalLink, ShieldAlert, Download, Calendar, Search, Shield, AlertTriangle, CheckCircle, RefreshCw, Trash2, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAuth } from 'firebase/auth';

interface WebHistory {
  id: string;
  url: string;
  timestamp: number;
  bloqueada: boolean;
  tipo?: string;
  fuente?: 'historial' | 'nextdns';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [blockingUrl, setBlockingUrl] = useState<string | null>(null);
  const [modoVista, setModoVista] = useState<'ultimas10' | 'historialDia' | 'todas'>('ultimas10');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [limpiando, setLimpiando] = useState(false);
  
  const [tempFechaInicio, setTempFechaInicio] = useState<string>('');
  const [tempFechaFin, setTempFechaFin] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  const ultimaUrlGuardada = useRef<string>('');

  // Extraer URL del detalle de NextDNS
  const extraerUrl = (detalle: string): string => {
    const match = detalle?.match(/bloqueó: (\S+)/);
    return match ? match[1] : 'desconocido';
  };

  // FUNCIÓN PARA GUARDAR URL EN HISTORIAL (evita duplicados)
  const guardarEnHistorial = useCallback(async (url: string) => {
    if (!deviceId || !url || url === 'Sin actividad' || url === 'null') return;
    if (url === ultimaUrlGuardada.current) return;
    
    try {
      const historialRef = ref(rtdb, `historial_navegacion/${deviceId}`);
      const nuevaEntry = {
        url: url,
        timestamp: Date.now(),
        bloqueada: false,
        tipo: 'PERMITIDA'
      };
      
      await push(historialRef, nuevaEntry);
      ultimaUrlGuardada.current = url;
      console.log(`✅ Historial guardado: ${url}`);
    } catch (err) {
      console.error('Error guardando historial:', err);
    }
  }, [deviceId]);

  // 1. Escuchar URL actual en status_dispositivos y guardarla automáticamente
  useEffect(() => {
    if (!isOpen || !deviceId) return;

    const statusRef = ref(rtdb, `status_dispositivos/${deviceId}/url_actual`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const urlActual = snapshot.val();
      if (urlActual && urlActual !== 'Sin actividad' && urlActual !== 'null') {
        guardarEnHistorial(urlActual);
      }
    });

    return () => off(statusRef);
  }, [isOpen, deviceId, guardarEnHistorial]);

  // 2. Escuchar historial de navegación desde RTDB
  useEffect(() => {
    if (!isOpen || !deviceId) return;
    setLoading(true);
    setError(null);

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
            tipo: value.bloqueada ? 'BLOQUEADA' : 'PERMITIDA',
            fuente: 'historial' as const
          }))
          .filter(item => item.url && !item.url.includes('busca en google') && !item.url.includes('chrome://'))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setHistory(historyList);
        setLastUpdate(new Date());
      } else {
        setHistory([]);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error cargando historial:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => {
      off(historialRef);
    };
  }, [isOpen, deviceId]);

  // 3. Escuchar alertas de seguridad (NextDNS)
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
        
        // También agregar alertas como historial visual
        const nextDNSHistory: WebHistory[] = alertsList.map(alert => ({
          id: alert.id,
          url: extraerUrl(alert.detalle),
          timestamp: alert.timestamp,
          bloqueada: true,
          tipo: 'BLOQUEADA',
          fuente: 'nextdns' as const
        }));
        
        setHistory(prev => {
          const combinadas = [...prev, ...nextDNSHistory];
          const unique = combinadas.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          return unique.sort((a, b) => b.timestamp - a.timestamp);
        });
      }
    }, (err) => {
      console.error("Error cargando alertas:", err);
    });

    return () => {
      off(alertasRef);
    };
  }, [isOpen, deviceId]);

  // Limpiar vista local
  const limpiarVista = () => {
    setLimpiando(true);
    setHistory([]);
    setTimeout(() => {
      setLimpiando(false);
    }, 1000);
  };

  // Refrescar manualmente
  const handleRefresh = () => {
    setRefreshing(true);
    const historialRef = ref(rtdb, `historial_navegacion/${deviceId}`);
    const alertasRef = ref(rtdb, `alertas_seguridad`);
    
    Promise.all([
      get(historialRef),
      get(alertasRef)
    ]).then(() => {
      setRefreshing(false);
      setLastUpdate(new Date());
    }).catch(() => {
      setRefreshing(false);
    });
  };

  // Filtrar por fechas y modo vista
  const filteredHistory = useMemo(() => {
    let result = history;
    
    // Filtro por fechas
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
    
    // Filtro por modo vista
    if (modoVista === 'ultimas10') {
      result = result.slice(0, 10);
    } else if (modoVista === 'historialDia') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      result = result.filter(item => item.timestamp >= hoy.getTime());
    }
    
    return result;
  }, [history, fechaInicio, fechaFin, modoVista]);

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

  const limpiarFiltros = () => {
    setTempFechaInicio('');
    setTempFechaFin('');
    setFechaInicio('');
    setFechaFin('');
  };

  const generatePDF = () => {
    const docPdf = new jsPDF();
    docPdf.setFillColor(15, 17, 23);
    docPdf.rect(0, 0, 210, 30, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(16);
    docPdf.text('EDUCONTROLPRO - REPORTE DE NAVEGACIÓN', 14, 13);
    docPdf.setFontSize(8);
    docPdf.setTextColor(249, 115, 22);
    docPdf.text(`ALUMNO: ${alumnoNombre.toUpperCase()}`, 14, 22);
    docPdf.text(`FECHA REPORTE: ${new Date().toLocaleString()}`, 14, 28);
    docPdf.setTextColor(0, 0, 0);
    
    const tableData = filteredHistory.map(h => [
      new Date(h.timestamp).toLocaleString(),
      h.url,
      h.bloqueada ? 'BLOQUEADA' : 'PERMITIDA'
    ]);

    let finalY = 45;
    
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

    const blockCount = filteredHistory.filter(h => h.bloqueada).length;
    
    docPdf.text(`Resumen: ${blockCount} URLs bloqueadas, ${filteredHistory.length} URLs totales`, 14, finalY + 10);
    
    docPdf.save(`Historial_${alumnoNombre}_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  if (!isOpen) return null;

  const totalBloqueadas = filteredHistory.filter(h => h.bloqueada).length;
  const totalPermitidas = filteredHistory.filter(h => !h.bloqueada).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-[#0f1117] border border-slate-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Globe className="text-orange-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">
                  Historial <span className="text-orange-500">Web</span>
                </h3>
                <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mt-1">
                  {alumnoNombre} | {deviceId}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Botones de control */}
          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={() => setModoVista('ultimas10')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                modoVista === 'ultimas10' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Eye size={12} /> ÚLTIMAS 10
            </button>
            <button
              onClick={() => setModoVista('historialDia')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                modoVista === 'historialDia' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Calendar size={12} /> HISTORIAL DEL DÍA
            </button>
            <button
              onClick={() => setModoVista('todas')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                modoVista === 'todas' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Globe size={12} /> TODAS
            </button>
            
            <div className="flex-1" />
            
            <button
              onClick={limpiarVista}
              disabled={limpiando}
              className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase flex items-center gap-2"
            >
              <Trash2 size={12} /> LIMPIAR PANTALLA
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-orange-500 transition-all"
              title="Actualizar en tiempo real"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl transition-all ${showFilters ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              <Calendar size={16} />
            </button>
          </div>
        </div>

        {/* Panel de Filtros */}
        {showFilters && (
          <div className="p-5 bg-slate-900/50 border-b border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input 
                type="date" 
                className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-white" 
                value={tempFechaInicio} 
                onChange={(e) => setTempFechaInicio(e.target.value)} 
              />
              <input 
                type="date" 
                className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-white" 
                value={tempFechaFin} 
                onChange={(e) => setTempFechaFin(e.target.value)} 
              />
              <button 
                onClick={handleBuscar} 
                className="bg-orange-500 hover:bg-orange-600 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
              >
                <Search size={14} /> BUSCAR
              </button>
              <button 
                onClick={limpiarFiltros} 
                className="bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
              >
                LIMPIAR
              </button>
            </div>
          </div>
        )}

        {/* Info de estado */}
        <div className="px-6 pt-3 pb-1 flex justify-between items-center">
          <div className="flex gap-4">
            <p className="text-[8px] text-green-500">✅ Permitidas: {totalPermitidas}</p>
            <p className="text-[8px] text-red-500">🚫 Bloqueadas: {totalBloqueadas}</p>
            <p className="text-[8px] text-orange-500">📋 Mostrando: {filteredHistory.length}</p>
          </div>
          <p className="text-[7px] text-slate-600 font-mono">
            Última actualización: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>

        {/* Lista de Historial */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Cargando historial en tiempo real...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <AlertTriangle className="text-red-500" size={32} />
              <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">Error: {error}</p>
              <button onClick={handleRefresh} className="bg-orange-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase">
                Reintentar
              </button>
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-2">
              {filteredHistory.map((item) => (
                <div 
                  key={item.id} 
                  className={`group p-4 rounded-xl border transition-all flex items-center justify-between ${
                    item.bloqueada 
                      ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/60' 
                      : 'bg-slate-900/40 border-slate-800/50 hover:border-orange-500/40'
                  }`}
                >
                  <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className={`p-2 rounded-xl transition-all ${
                      item.bloqueada ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-slate-500 group-hover:text-orange-500'
                    }`}>
                      {item.bloqueada ? <ShieldAlert size={14} /> : <Globe size={14} />}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className={`text-xs font-bold truncate italic tracking-tight ${
                        item.bloqueada ? 'text-red-400' : 'text-slate-200'
                      }`}>
                        {item.url}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[9px] text-slate-500 font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                        <span className={`text-[7px] px-2 py-0.5 rounded-full ${
                          item.bloqueada 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {item.bloqueada ? 'BLOQUEADA' : 'PERMITIDA'}
                        </span>
                        {item.fuente === 'nextdns' && (
                          <span className="text-[6px] px-1 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                            NEXTDNS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!item.bloqueada && (
                    <button 
                      onClick={() => handleBlockDomain(item.url)}
                      disabled={blockingUrl === item.url}
                      className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-lg transition-all ml-2 shrink-0"
                      title="Bloquear este sitio"
                    >
                      {blockingUrl === item.url ? 
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 
                        <Shield size={14} />
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center opacity-40">
              <ShieldAlert size={48} className="mx-auto mb-4 text-slate-700" />
              <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Sin historial de navegación</p>
              <p className="text-[8px] text-slate-700 mt-2">
                {modoVista === 'ultimas10' && 'No hay URLs recientes para mostrar'}
                {modoVista === 'historialDia' && 'El alumno no ha navegado hoy'}
                {modoVista === 'todas' && 'No hay registros de URLs visitadas para este dispositivo'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center">
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.2em]">
            EFAS SERVICONTROL V2.4 - NEXTDNS INTEGRATION
          </p>
          <div className="flex gap-3">
            <button 
              onClick={generatePDF} 
              disabled={filteredHistory.length === 0} 
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-lg shadow-orange-500/10"
            >
              <Download size={14} /> EXPORTAR PDF
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>
    </div>
  );
}