'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db, rtdb } from '@/firebase/config';
import { 
  collection, query, where, getDocs, writeBatch, doc, onSnapshot 
} from 'firebase/firestore';
import { ref, onValue, remove, query as rtdbQuery, orderByChild, limitToLast, off } from 'firebase/database';
import { 
  ShieldAlert, Globe, Monitor, Trash2, Clock, CheckCircle, MessageSquare, History, 
  Search, Calendar, Download, Zap, AlertTriangle, Eraser, Loader2, Smartphone, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  url?: string;
}

interface DeviceInfo {
  deviceId: string;
  alumno_asignado?: string;
  aulaId?: string;
  seccion?: string;
  InstitutoId?: string;
}

interface IncidentsTableProps {
  institutionId: string;
  onViewHistory?: (deviceId: string, alumnoNombre: string) => void;
  onSendMessage?: (deviceId: string, alumnoNombre: string) => void;
}

export function IncidentsTable({ institutionId, onViewHistory, onSendMessage }: IncidentsTableProps) {
  const [incidents, setIncidents] = useState<SecurityAlert[]>([]);
  const [devicesMap, setDevicesMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exportando, setExportando] = useState(false);

  // 1. Cargar dispositivos DESDE RTDB (donde está alumno_asignado)
  useEffect(() => {
    if (!institutionId) return;
    
    const dispositivosRef = ref(rtdb, 'dispositivos');
    
    const unsubscribe = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      const map = new Map<string, DeviceInfo>();
      
      if (data) {
        Object.entries(data).forEach(([deviceId, device]: [string, any]) => {
          if (device.InstitutoId === institutionId) {
            map.set(deviceId, {
              deviceId: deviceId,
              alumno_asignado: device.alumno_asignado || 'Sin asignar',
              aulaId: device.aulaId || '—',
              seccion: device.seccion || '—',
              InstitutoId: device.InstitutoId
            });
          }
        });
      }
      
      console.log('📱 Dispositivos cargados desde RTDB:', Array.from(map.entries()));
      setDevicesMap(map);
    });

    return () => off(dispositivosRef);
  }, [institutionId]);

  // 2. Escuchar alertas desde RTDB (alertas_seguridad)
  useEffect(() => {
    if (!institutionId) return;

    const alertasRef = ref(rtdb, 'alertas_seguridad');
    
    const unsubscribe = onValue(alertasRef, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setIncidents([]);
        setLoading(false);
        return;
      }
      
      // Filtrar alertas de dispositivos de esta sede
      const alertsList: SecurityAlert[] = Object.entries(data)
        .map(([key, value]: [string, any]) => ({
          id: key,
          tipo: value.tipo || 'desconocido',
          detalle: value.detalle || '',
          timestamp: value.timestamp || 0,
          deviceId: value.deviceId || '',
          url: value.detalle
        }))
        .filter(alert => {
          // 🔥 CORREGIDO: Incluir 'url_prohibida' (NextDNS) y 'nextdns_block' también
          const isBlockAlert = [
            'busqueda_prohibida', 'url_prohibida', 'nextdns_block', 'app_prohibida', 
            'configuracion_navegador', 'ajustes_sistema'
          ].includes(alert.tipo);
          if (!isBlockAlert) return false;
          
          // Verificar que el dispositivo pertenezca a esta sede
          return devicesMap.has(alert.deviceId);
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      
      setIncidents(alertsList);
      setLoading(false);
    }, (err) => {
      console.error('Error en RTDB:', err);
      setLoading(false);
    });

    return () => off(alertasRef);
  }, [institutionId, devicesMap]);

  // 3. Función para obtener información del dispositivo
  const getDeviceInfo = (deviceId: string) => {
    return devicesMap.get(deviceId) || {
      deviceId: deviceId,
      alumno_asignado: 'Sin asignar',
      aulaId: '—',
      seccion: '—'
    };
  };

  // 4. Función para obtener el tipo de alerta formateado
  const getTipoInfo = (tipo: string, detalle: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        const match = detalle.match(/palabra: (\w+)/i);
        return { label: match ? `Búsqueda: "${match[1]}"` : 'Búsqueda prohibida', icon: <Globe size={16} />, color: 'text-red-500' };
      case 'url_prohibida':
      case 'nextdns_block':
        const urlMatch = detalle.match(/dominio "([^"]+)"/i);
        const nextMatch = detalle.match(/NextDNS bloqueó: ([^\s]+)/i);
        const domain = urlMatch ? urlMatch[1] : (nextMatch ? nextMatch[1] : detalle.substring(0, 30));
        return { label: `URL: ${domain}`, icon: <Globe size={16} />, color: 'text-red-500' };
      case 'app_prohibida':
        const appMatch = detalle.match(/abrir: ([\w.]+)/i);
        return { label: appMatch ? `App: ${appMatch[1].split('.').pop()}` : 'App prohibida', icon: <Smartphone size={16} />, color: 'text-orange-500' };
      case 'configuracion_navegador':
        return { label: 'Configuración navegador', icon: <ShieldAlert size={16} />, color: 'text-yellow-500' };
      case 'ajustes_sistema':
        return { label: 'Ajustes del sistema', icon: <Monitor size={16} />, color: 'text-purple-500' };
      default:
        return { label: detalle.substring(0, 30), icon: <AlertTriangle size={16} />, color: 'text-slate-500' };
    }
  };

  // 5. Limpiar registros antiguos
  const clearAllIncidents = async () => {
    if (!confirm("⚠️ ¿BORRAR TODO? Esta acción eliminará todos los registros de alertas de esta sede de la base de datos.")) return;
    
    setIsCleaning(true);
    let deletedCount = 0;
    
    try {
      for (const alert of incidents) {
        await remove(ref(rtdb, `alertas_seguridad/${alert.id}`));
        deletedCount++;
      }
      
      toast({
        title: "SISTEMA DEPURADO",
        description: `Se han eliminado ${deletedCount} registros.`,
      });
      
      setIncidents([]);
    } catch (error) {
      console.error('Error en limpieza:', error);
      toast({
        variant: "destructive",
        title: "Error en limpieza"
      });
    } finally {
      setIsCleaning(false);
    }
  };

  // 6. Filtrar por búsqueda
  const filteredIncidents = useMemo(() => {
    let filtradas = incidents;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtradas = filtradas.filter(inc => {
        const devInfo = getDeviceInfo(inc.deviceId);
        return (devInfo.alumno_asignado?.toLowerCase().includes(term)) ||
                (inc.deviceId?.toLowerCase().includes(term)) ||
                (devInfo.aulaId?.toLowerCase().includes(term)) ||
                (inc.detalle?.toLowerCase().includes(term));
      });
    }
    
    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      filtradas = filtradas.filter(inc => inc.timestamp >= inicio.getTime());
    }
    
    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      filtradas = filtradas.filter(inc => inc.timestamp <= fin.getTime());
    }
    
    return filtradas;
  }, [incidents, searchTerm, fechaInicio, fechaFin]);

  // 7. Exportar a PDF
  const exportToPDF = () => {
    if (filteredIncidents.length === 0) {
      toast({ title: "No hay datos para exportar" });
      return;
    }
    
    setExportando(true);
    try {
      const doc = new jsPDF();
      doc.setFillColor(15, 17, 23);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('REPORTE DE INFRACCIONES - EDUControlPro', 14, 13);
      doc.setTextColor(0, 0, 0);
      
      const tableData = filteredIncidents.map(inc => {
        const devInfo = getDeviceInfo(inc.deviceId);
        const tipoInfo = getTipoInfo(inc.tipo, inc.detalle);
        return [
          devInfo.alumno_asignado || 'Sin asignar',
          devInfo.aulaId || '—',
          new Date(inc.timestamp).toLocaleString() || '',
          tipoInfo.label || ''
        ];
      });
      
      let finalY = 30;
      autoTable(doc, {
        startY: finalY,
        head: [['Alumno', 'Aula', 'Fecha/Hora', 'Infracción']],
        body: tableData,
        headStyles: { fillColor: [249, 115, 22] },
        styles: { fontSize: 8 },
        didDrawPage: (data) => {
          finalY = data.cursor?.y || finalY;
        }
      });
      
      doc.save(`infracciones_${new Date().toISOString().slice(0,10)}.pdf`);
      toast({ title: "PDF generado correctamente" });
    } catch (error) {
      console.error('Error PDF:', error);
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setExportando(false);
    }
  };

  if (loading) return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-16 text-center shadow-2xl">
      <Loader2 className="animate-spin w-8 h-8 text-orange-500 mx-auto mb-6" />
      <p className="text-orange-500 font-black text-[11px] uppercase tracking-[0.3em] italic">Sincronizando Centinela...</p>
    </div>
  );

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
      
      {/* Header */}
      <div className="p-8 border-b border-white/5 bg-gradient-to-br from-slate-900/50 to-transparent flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-3">
            <ShieldAlert className="text-orange-500 w-6 h-6 animate-pulse" /> Registro de <span className="text-orange-500 underline">Infracciones</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Sede Protegida • {filteredIncidents.length} Eventos
          </p>
        </div>

        <div className="flex items-center gap-3">
            <Button 
                onClick={clearAllIncidents}
                disabled={isCleaning || incidents.length === 0}
                variant="ghost"
                className="bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter px-4"
            >
                {isCleaning ? <Loader2 className="animate-spin mr-2" size={14}/> : <Eraser size={14} className="mr-2" />}
                Limpiar Todo
            </Button>

            <Button 
                onClick={() => setShowFilters(!showFilters)} 
                variant="outline"
                className="bg-slate-900 border-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter"
            >
                <Search size={14} className="mr-2" /> {showFilters ? 'Cerrar' : 'Buscar'}
            </Button>
            
            <Button 
                onClick={exportToPDF}
                disabled={filteredIncidents.length === 0 || exportando}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 rounded-xl text-[10px] font-black uppercase"
            >
                {exportando ? <Loader2 className="animate-spin mr-2" size={14} /> : <Download size={14} className="mr-2" />}
                PDF
            </Button>
        </div>
      </div>

      {/* Panel de Filtros */}
      {showFilters && (
        <div className="p-6 bg-slate-900/50 border-b border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              type="text" 
              placeholder="Buscar alumno, aula o dispositivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white text-xs"
            />
            <input 
              type="date" 
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white text-xs"
            />
            <input 
              type="date" 
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white text-xs"
            />
          </div>
        </div>
      )}

      {/* Lista de Registros */}
      <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar bg-slate-950/20">
        {filteredIncidents.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <CheckCircle className="w-12 h-12 text-slate-800 mb-4" />
            <p className="text-slate-600 font-black uppercase text-[10px] tracking-[0.2em]">Monitor en Blanco: Sin incidencias</p>
          </div>
        ) : (
          filteredIncidents.map((inc) => {
            const devInfo = getDeviceInfo(inc.deviceId);
            const tipoInfo = getTipoInfo(inc.tipo, inc.detalle);
            return (
              <div key={inc.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-4 w-full">
                  <div className={`p-3 rounded-xl shrink-0 ${tipoInfo.color.replace('text', 'bg')}/10`}>
                    {tipoInfo.icon}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {/* Alumno */}
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Alumno</p>
                      <p className="text-xs font-black text-white uppercase italic truncate">
                        {devInfo.alumno_asignado}
                      </p>
                    </div>

                    {/* Aula */}
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Ubicación</p>
                      <p className="text-xs font-black text-white uppercase italic">
                        {devInfo.aulaId} - {devInfo.seccion}
                      </p>
                    </div>

                    {/* Dispositivo */}
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">ID Equipo</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        {inc.deviceId.substring(0, 12)}...
                      </p>
                    </div>

                    {/* Hora e Infracción */}
                    <div className="text-right">
                      <p className="text-[8px] text-orange-500 font-black uppercase tracking-tighter">
                        {new Date(inc.timestamp).toLocaleTimeString()}
                      </p>
                      <p className={`text-[9px] font-bold truncate italic ${tipoInfo.color}`}>
                        {tipoInfo.label}
                      </p>
                    </div>
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="flex gap-2 shrink-0">
                    {onViewHistory && (
                      <button 
                        onClick={() => onViewHistory(inc.deviceId, devInfo.alumno_asignado || 'Sin asignar')}
                        className="p-2 bg-slate-800 hover:bg-orange-500 rounded-xl transition-all"
                        title="Ver historial"
                      >
                        <History size={14} className="text-slate-400 hover:text-white" />
                      </button>
                    )}
                    {onSendMessage && (
                      <button 
                        onClick={() => onSendMessage(inc.deviceId, devInfo.alumno_asignado || 'Sin asignar')}
                        className="p-2 bg-slate-800 hover:bg-orange-500 rounded-xl transition-all"
                        title="Enviar mensaje"
                      >
                        <MessageSquare size={14} className="text-slate-400 hover:text-white" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 bg-slate-950/50 border-t border-white/5 text-center">
        <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] italic">EFAS ServiControl v2.4</p>
      </div>
    </div>
  );
}