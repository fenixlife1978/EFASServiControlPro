'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, query, limitToLast, remove } from 'firebase/database';
import { AlertTriangle, Clock, Smartphone, Globe, Download, Trash2, FileText, FileSpreadsheet, ShieldAlert, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SecurityAlert {
  id: string;
  tipo: string;
  detalle: string;
  timestamp: number;
  deviceId: string;
  dispositivoNombre?: string;
}

interface DeviceInfo {
  id: string;
  alumnoNombre?: string;
  alumno_asignado?: string;
  nombre?: string;
  InstitutoId: string;
}

export function BlockedAttempts() {
  const { institutionId } = useInstitution();
  const [attempts, setAttempts] = useState<SecurityAlert[]>([]);
  const [allAttempts, setAllAttempts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [validDevicesMap, setValidDevicesMap] = useState<Map<string, DeviceInfo>>(new Map());
  const [showAllDialog, setShowAllDialog] = useState(false);

  // 1. Obtener dispositivos válidos de esta sede
  useEffect(() => {
    if (!institutionId) return;
    
    const fetchDevices = async () => {
      try {
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await new Promise<any>((resolve) => {
          onValue(dispositivosRef, (snap) => resolve(snap), { onlyOnce: true });
        });
        const data = snapshot.val();
        
        const map = new Map<string, DeviceInfo>();
        
        if (data) {
          Object.entries(data).forEach(([deviceId, deviceData]: [string, any]) => {
            if (deviceData.InstitutoId === institutionId) {
              map.set(deviceId, {
                id: deviceId,
                alumnoNombre: deviceData.alumno_asignado || deviceData.nombre || deviceId,
                alumno_asignado: deviceData.alumno_asignado,
                nombre: deviceData.nombre,
                InstitutoId: deviceData.InstitutoId
              });
            }
          });
        }
        
        setValidDevicesMap(map);
      } catch (error) {
        console.error('Error cargando dispositivos:', error);
      }
    };
    
    fetchDevices();
  }, [institutionId]);

  // 2. Escuchar alertas - CORREGIDO: Ahora muestra TODOS los bloqueos
  useEffect(() => {
    if (!institutionId) return;

    const alertasRef = ref(rtdb, 'alertas_seguridad');
    const recentQuery = query(alertasRef, limitToLast(200));
    
    const unsubscribe = onValue(recentQuery, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        setAttempts([]);
        setAllAttempts([]);
        setLoading(false);
        return;
      }
      
      const list: SecurityAlert[] = [];
      
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        const deviceId = value.deviceId || '';
        const deviceInfo = validDevicesMap.get(deviceId);
        
        const isBlockAlert = [
          'busqueda_prohibida', 'url_prohibida', 'app_prohibida', 
          'app_restringida', 'configuracion_navegador', 'ajustes_sistema', 'modo_blindado'
        ].includes(value.tipo);
        
        // CORRECCIÓN: Mostrar bloqueos incluso si el dispositivo no está registrado
        if (isBlockAlert) {
          list.push({
            id: key,
            tipo: value.tipo || 'desconocido',
            detalle: value.detalle || '',
            timestamp: value.timestamp || 0,
            deviceId: deviceId,
            dispositivoNombre: deviceInfo?.alumnoNombre || deviceInfo?.nombre || deviceId || 'Desconocido'
          });
        }
      });
      
      const sorted = list.sort((a, b) => b.timestamp - a.timestamp);
      setAllAttempts(sorted);
      setAttempts(sorted.slice(0, 5));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId, validDevicesMap]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTipoIcon = (tipo: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
      case 'url_prohibida':
        return <Globe className="w-3 h-3 text-red-500" />;
      case 'app_prohibida':
      case 'app_restringida':
        return <Smartphone className="w-3 h-3 text-orange-500" />;
      default:
        return <ShieldAlert className="w-3 h-3 text-yellow-500" />;
    }
  };

  const getTipoLabel = (tipo: string, detalle: string) => {
    switch(tipo) {
      case 'busqueda_prohibida':
        const match = detalle.match(/palabra: (\w+)/i);
        return match ? `Búsqueda: "${match[1]}"` : detalle.substring(0, 40);
      case 'url_prohibida':
        const urlMatch = detalle.match(/dominio "([^"]+)"/i);
        return urlMatch ? `URL: ${urlMatch[1]}` : detalle.substring(0, 40);
      case 'app_prohibida':
      case 'app_restringida':
        const appMatch = detalle.match(/abrir: ([\w.]+)/i);
        return appMatch ? `App: ${appMatch[1].split('.').pop()}` : detalle.substring(0, 40);
      default:
        return detalle.substring(0, 40);
    }
  };

  const exportToExcel = () => {
    try {
      const data = allAttempts.map(item => ({
        Tipo: item.tipo,
        Detalle: item.detalle,
        Dispositivo: item.dispositivoNombre || item.deviceId,
        Fecha: formatDate(item.timestamp)
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Intentos Bloqueados');
      XLSX.writeFile(wb, `intentos_bloqueados_${institutionId}_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success('Archivo Excel generado correctamente');
    } catch (error) {
      toast.error('Error al generar el archivo Excel');
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Reporte de Intentos Bloqueados - Sede ${institutionId}`, 14, 22);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 30);
      doc.text(`Total de registros: ${allAttempts.length}`, 14, 38);

      const tableData = allAttempts.map(item => [
        getTipoLabel(item.tipo, item.detalle),
        item.dispositivoNombre || item.deviceId.substring(0, 12),
        formatDate(item.timestamp)
      ]);

      autoTable(doc, {
        head: [['Detalle', 'Dispositivo', 'Fecha']],
        body: tableData,
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] }
      });

      doc.save(`intentos_bloqueados_${institutionId}_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('Archivo PDF generado correctamente');
    } catch (error) {
      toast.error('Error al generar el archivo PDF');
    }
  };

  const cleanOldRecords = async () => {
    if (!confirm('¿Estás seguro de eliminar todos los registros con más de 7 días de antigüedad?')) return;

    setCleaning(true);
    const toastId = toast.loading('Limpiando registros antiguos...');
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const allRef = ref(rtdb, 'alertas_seguridad');
      const snapshot = await new Promise<any>((resolve) => {
        onValue(allRef, (snap) => resolve(snap), { onlyOnce: true });
      });

      if (snapshot.exists()) {
        const promises = Object.entries(snapshot.val()).map(async ([key, value]: [string, any]) => {
          if (value.timestamp && value.timestamp < sevenDaysAgo && value.InstitutoId === institutionId) {
            await remove(ref(rtdb, `alertas_seguridad/${key}`));
            deletedCount++;
          }
        });
        await Promise.all(promises);
      }

      toast.success(`${deletedCount} registros eliminados`, { id: toastId });
    } catch (error) {
      toast.error('Error al limpiar registros', { id: toastId });
    } finally {
      setCleaning(false);
    }
  };

  const limpiarVisual = () => {
    setAttempts([]);
    toast.success('Vista de alertas limpiada');
  };

  if (loading) {
    return (
      <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
        <div className="text-center py-8 text-slate-500">Cargando alertas...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-red-500 w-6 h-6" />
          <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">
            Intentos <span className="text-red-500">Bloqueados</span>
          </h2>
        </div>
        <span className="text-[9px] text-slate-500 font-mono">
          {allAttempts.length} registros totales
        </span>
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button onClick={exportToExcel} disabled={allAttempts.length === 0} className="bg-emerald-600 hover:bg-emerald-700 h-8 text-[10px]">
          <FileSpreadsheet size={14} className="mr-1" /> EXCEL
        </Button>
        <Button onClick={exportToPDF} disabled={allAttempts.length === 0} className="bg-red-600 hover:bg-red-700 h-8 text-[10px]">
          <FileText size={14} className="mr-1" /> PDF
        </Button>
        <Button onClick={cleanOldRecords} disabled={cleaning} className="bg-slate-700 hover:bg-red-600 h-8 text-[10px]">
          <Trash2 size={14} className="mr-1" /> LIMPIAR +7 DÍAS
        </Button>
        <Button onClick={limpiarVisual} className="bg-slate-700 hover:bg-slate-600 h-8 text-[10px] ml-auto">
          LIMPIAR VISTA
        </Button>
        <Button onClick={() => setShowAllDialog(true)} className="bg-orange-500 hover:bg-orange-600 h-8 text-[10px]">
          <Eye size={14} className="mr-1" /> VER LISTA COMPLETA
        </Button>
      </div>

      {attempts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
          <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
            No hay intentos bloqueados registrados
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[9px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="pb-3 pl-2">Tipo</th>
                <th className="pb-3">Detalle</th>
                <th className="pb-3">Dispositivo</th>
                <th className="pb-3">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {attempts.map((item) => (
                <tr key={item.id} className="text-xs hover:bg-slate-900/20 transition-colors">
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-2">
                      {getTipoIcon(item.tipo)}
                      <span className="text-[9px] font-mono text-slate-400 uppercase">
                        {item.tipo === 'busqueda_prohibida' ? 'BÚSQUEDA' : 
                         item.tipo === 'url_prohibida' ? 'URL' :
                         item.tipo === 'app_prohibida' ? 'APP' : 'SISTEMA'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-red-400 text-[10px] font-mono break-all max-w-xs block">
                      {getTipoLabel(item.tipo, item.detalle)}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-400 text-[9px] font-mono">
                        {item.dispositivoNombre || item.deviceId.substring(0, 12)}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-400 text-[9px]">{formatDate(item.timestamp)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allAttempts.length > 5 && (
            <div className="text-center pt-4">
              <Button onClick={() => setShowAllDialog(true)} variant="ghost" className="text-orange-500 text-[10px]">
                + Ver {allAttempts.length - 5} registros más...
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal con lista completa */}
      <Dialog open={showAllDialog} onOpenChange={setShowAllDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Lista Completa de Infracciones</DialogTitle>
            <p className="text-[10px] text-slate-500">Total: {allAttempts.length} registros</p>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[9px] text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Detalle</th>
                  <th className="pb-2">Dispositivo</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {allAttempts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {getTipoIcon(item.tipo)}
                        <span className="text-[9px] font-mono text-slate-400">
                          {item.tipo === 'busqueda_prohibida' ? 'BÚSQUEDA' : 
                           item.tipo === 'url_prohibida' ? 'URL' : 'APP'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2">
                      <span className="text-red-400 text-[9px] break-all max-w-md block">
                        {getTipoLabel(item.tipo, item.detalle)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="text-slate-400 text-[9px]">{item.dispositivoNombre || item.deviceId.substring(0, 12)}</span>
                    </td>
                    <td className="py-2">
                      <span className="text-slate-500 text-[9px]">{formatDate(item.timestamp)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}