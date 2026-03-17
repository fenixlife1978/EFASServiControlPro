'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, query, limitToLast, remove } from 'firebase/database';
import { AlertTriangle, Clock, Smartphone, Globe, Download, Trash2, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface BlockedAttempt {
  id: string;
  url: string;
  deviceId: string;
  timestamp: number;
  status: string;
}

export function BlockedAttempts() {
  const [attempts, setAttempts] = useState<BlockedAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    const attemptsRef = query(
      ref(rtdb, 'system_analysis/blocked_attempts'),
      limitToLast(50) // últimos 50 intentos
    );
    const unsubscribe = onValue(attemptsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).reverse(); // más reciente primero
        setAttempts(list);
      } else {
        setAttempts([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  // ====================================================
  // EXPORTAR A EXCEL
  // ====================================================
  const exportToExcel = () => {
    try {
      const data = attempts.map(item => ({
        URL: item.url,
        Dispositivo: item.deviceId,
        Fecha: formatDate(item.timestamp),
        Estado: item.status || 'Expulsado'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Intentos Bloqueados');
      XLSX.writeFile(wb, `intentos_bloqueados_${new Date().toISOString().slice(0,10)}.xlsx`);
      
      toast.success('Archivo Excel generado correctamente');
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast.error('Error al generar el archivo Excel');
    }
  };

  // ====================================================
  // EXPORTAR A PDF
  // ====================================================
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(16);
      doc.text('Reporte de Intentos Bloqueados', 14, 22);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 30);

      // Tabla
      const tableData = attempts.map(item => [
        item.url,
        item.deviceId,
        formatDate(item.timestamp),
        item.status || 'Expulsado'
      ]);

      autoTable(doc, {
        head: [['URL', 'Dispositivo', 'Fecha', 'Estado']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] } // rojo
      });

      doc.save(`intentos_bloqueados_${new Date().toISOString().slice(0,10)}.pdf`);
      
      toast.success('Archivo PDF generado correctamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al generar el archivo PDF');
    }
  };

  // ====================================================
  // LIMPIAR REGISTROS ANTIGUOS (MÁS DE 7 DÍAS)
  // ====================================================
  const cleanOldRecords = async () => {
    if (!confirm('¿Estás seguro de eliminar todos los registros con más de 7 días de antigüedad?')) return;

    setCleaning(true);
    const toastId = toast.loading('Limpiando registros antiguos...');
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      // Obtenemos todos los intentos (sin límite)
      const allRef = ref(rtdb, 'system_analysis/blocked_attempts');
      const snapshot = await new Promise<any>((resolve, reject) => {
        onValue(allRef, (snap) => resolve(snap.val()), { onlyOnce: true });
      });

      if (snapshot) {
        const promises = Object.entries(snapshot).map(async ([key, value]: [string, any]) => {
          if (value.timestamp < sevenDaysAgo) {
            await remove(ref(rtdb, `system_analysis/blocked_attempts/${key}`));
            deletedCount++;
          }
        });
        await Promise.all(promises);
      }

      toast.success(`${deletedCount} registros eliminados`, { id: toastId });
    } catch (error) {
      console.error('Error al limpiar:', error);
      toast.error('Error al limpiar registros', { id: toastId });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="text-red-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">
          Intentos <span className="text-red-500">Bloqueados</span>
        </h2>
      </div>

      {/* BARRA DE ACCIONES */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={exportToExcel}
          disabled={attempts.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"
        >
          <FileSpreadsheet size={16} />
          EXCEL
        </button>
        <button
          onClick={exportToPDF}
          disabled={attempts.length === 0}
          className="bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"
        >
          <FileText size={16} />
          PDF
        </button>
        <button
          onClick={cleanOldRecords}
          disabled={cleaning || attempts.length === 0}
          className="bg-slate-700 hover:bg-red-600 disabled:bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ml-auto"
        >
          <Trash2 size={16} />
          {cleaning ? 'LIMPIANDO...' : 'LIMPIAR +7 DÍAS'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Cargando...</div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
            No hay intentos bloqueados registrados
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[9px] text-slate-500 font-black uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="pb-3 pl-2">URL</th>
                <th className="pb-3">Dispositivo</th>
                <th className="pb-3">Fecha</th>
                <th className="pb-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {attempts.map((item) => (
                <tr key={item.id} className="text-xs hover:bg-slate-900/20 transition-colors">
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-slate-600" />
                      <span className="font-mono text-red-400 text-[10px]">{item.url}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-400 text-[9px] font-mono">{item.deviceId}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-400 text-[9px]">{formatDate(item.timestamp)}</span>
                    </div>
                  </td>
                  <td className="py-4 text-center">
                    <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-full text-[8px] font-black uppercase">
                      {item.status || 'Expulsado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}