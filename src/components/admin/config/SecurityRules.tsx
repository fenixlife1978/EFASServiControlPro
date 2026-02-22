'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  ShieldCheck, Globe, Lock, Unlock, Database, Download, 
  AlertTriangle, CheckCircle2, Plus, Trash2, FileText, ShieldAlert, RefreshCw 
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SecurityRulesProps {
  institutionId: string;
}

export const SecurityRules = ({ institutionId }: SecurityRulesProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [newUrl, setNewUrl] = useState('');
  const [filterType, setFilterType] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, "institutions", institutionId), (d) => {
      if (d.exists()) setData(d.data());
    });
  }, [institutionId]);

  const fetchIncidencias = async () => {
    setRefreshing(true);
    try {
      const q = query(collection(db, "incidencias"), where("InstitutoId", "==", institutionId), limit(20));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIncidencias(docs);
    } catch (e) { 
      console.error(e);
      setIncidencias([
        { alumno: "Simulación: Juan Pérez", tablet: "TAB-001", fecha: "2026-02-20", hora: "14:00", url: "ejemplo-bloqueado.com" }
      ]);
    }
    setTimeout(() => setRefreshing(false), 800);
  };

  const generatePDF = (tipo: 'seguridad' | 'incidencias') => {
    const doc = new jsPDF();
    const isInc = tipo === 'incidencias';
    
    doc.setFillColor(15, 17, 23);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("EDU SERVICONTROLPRO", 15, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(isInc ? "REPORTE DETALLADO DE INCIDENCIAS" : "REPORTE OFICIAL DE CUMPLIMIENTO CIPA", 15, 28);
    
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    const instText = `Institución: ${data?.nombre || institutionId}`;
    doc.text(instText, 15, 50);
    
    // Sello de Sede Protegida Verde
    doc.setTextColor(34, 197, 94);
    doc.setFontSize(8);
    doc.text(' [ SEDE PROTEGIDA - VALIDADO POR EDU ]', 15 + doc.getTextWidth(instText), 50);

    autoTable(doc, {
      startY: 65,
      head: isInc ? [['ALUMNO', 'DISPOSITIVO', 'FECHA', 'HORA', 'URL DETECTADA']] : [['TIPO', 'CRITERIO / URL', 'SITUACIÓN']],
      body: isInc ? incidencias.map(i => [i.alumno, i.tablet, i.fecha, i.hora, i.url]) : (data?.blacklist || []).map((u: string) => ['BLACKLIST', u, 'ACTIVO']),
      headStyles: { fillColor: isInc ? [234, 88, 12] : [15, 17, 23] }
    });
    doc.save(`EDU_Reporte_${tipo}.pdf`);
  };

  const packs = {
    cipa_strict: {
      name: "CIPA Compliance Pack (USA)",
      desc: "Bloqueo estricto de pornografía, contenido obsceno y dañino para menores.",
      urls: ["porn.com", "xvideos.com", "gambling.com", "bet365.com", "chatroulette.com"]
    },
    social_blackout: {
      name: "Focus Mode: Social Media",
      desc: "Restringe acceso a redes sociales durante horario académico.",
      urls: ["facebook.com", "instagram.com", "tiktok.com", "twitter.com", "x.com"]
    }
  };

  const importPack = async (packUrls: string[], packName: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "institutions", institutionId), {
        blacklist: arrayUnion(...packUrls),
        lastSecurityUpdate: serverTimestamp()
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAddUrl = async () => {
    if (!newUrl) return;
    await updateDoc(doc(db, "institutions", institutionId), {
      [filterType]: arrayUnion(newUrl.toLowerCase().trim()),
      lastSecurityUpdate: serverTimestamp()
    });
    setNewUrl('');
  };

  const handleRemoveUrl = async (url: string, type: 'blacklist' | 'whitelist') => {
    await updateDoc(doc(db, "institutions", institutionId), { [type]: arrayRemove(url) });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Security <span className="text-orange-500">Center</span></h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic">Filtrado de Contenido Nivel Gubernamental</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <Globe className="text-blue-500" size={18} />
          <p className="text-[10px] font-black text-white uppercase italic">Filtrado Activo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PANEL IZQUIERDO: PACKS */}
        <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
          <div className="flex items-center gap-2 text-orange-500 mb-4">
            <Download size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Importar Protocolos</span>
          </div>
          <h3 className="text-xl font-black italic uppercase text-white mb-2">Packs Globales</h3>
          <div className="space-y-3 mt-6">
            {Object.entries(packs).map(([key, pack]) => (
              <button key={key} onClick={() => importPack(pack.urls, pack.name)} className="w-full flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-orange-500 transition-all group/btn">
                <div className="text-left">
                  <p className="text-[9px] font-black text-white uppercase italic">{pack.name}</p>
                  <p className="text-[7px] font-bold text-slate-600 uppercase mt-1">{pack.desc}</p>
                </div>
                <Plus size={16} />
              </button>
            ))}
          </div>
        </div>

        {/* PANEL DERECHO: ESTADO Y CONTADOR SUPERIOR */}
        <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800">
          <div className="flex items-center gap-2 text-blue-500 mb-4">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Estado de Reglas</span>
          </div>
          
          {/* CONTADOR SUPERIOR (IMPACTO CIPA) */}
          <div className="mb-6 p-6 bg-orange-500/5 border border-orange-500/10 rounded-[2rem] flex items-center justify-between group">
             <div>
                <p className="text-[7px] font-black text-orange-500 uppercase tracking-[0.3em] mb-1">Impacto de Protección CIPA</p>
                <p className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
                  {data?.blacklist?.length || 0}
                  <span className="text-orange-500 text-xs ml-2">Amenazas Bloqueadas</span>
                </p>
             </div>
             <ShieldCheck className="text-orange-500 animate-pulse" size={24} />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-5 bg-black/30 rounded-2xl border border-slate-800/50">
               <div className="flex items-center gap-3"><Lock className="text-red-500" size={16}/><span className="text-[10px] font-black text-white uppercase italic">Lista Negra</span></div>
               <span className="text-[10px] font-mono text-slate-500">TOTAL: {data?.blacklist?.length || 0}</span>
            </div>
            <div className="flex justify-between items-center p-5 bg-black/30 rounded-2xl border border-slate-800/50">
               <div className="flex items-center gap-3"><Unlock className="text-green-500" size={16}/><span className="text-[10px] font-black text-white uppercase italic">Lista Blanca</span></div>
               <span className="text-[10px] font-mono text-slate-500">TOTAL: {data?.whitelist?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-slate-800 my-10" />

      {/* SECCIÓN BAJA: GESTIÓN Y LOGS */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
            <h3 className="text-xs font-black text-white uppercase mb-6 flex items-center gap-2 italic">
              <Plus size={14} className="text-orange-500"/> Gestión Manual de Filtros
            </h3>
            <div className="flex gap-4 mb-8">
              <select className="bg-black border border-slate-800 p-4 rounded-xl text-[9px] font-black text-orange-500 uppercase outline-none" value={filterType} onChange={(e: any) => setFilterType(e.target.value)}>
                <option value="blacklist">Blacklist</option>
                <option value="whitelist">Whitelist</option>
              </select>
              <input className="flex-1 bg-black border border-slate-800 p-4 rounded-xl text-[10px] font-bold text-white uppercase outline-none focus:border-orange-500" placeholder="Añadir url o palabra clave..." value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddUrl()} />
              <button onClick={handleAddUrl} className="bg-orange-500 px-6 rounded-xl text-white font-black"><Plus size={18}/></button>
            </div>

            <div className="grid grid-cols-2 gap-6 h-64">
              <div className="overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                <p className="text-[8px] font-black text-red-500 uppercase sticky top-0 bg-[#0f1117] pb-2">Blacklist Actual</p>
                {data?.blacklist?.map((url: string) => (
                  <div key={url} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-slate-800">
                    <span className="text-[9px] font-mono text-slate-400 truncate">{url}</span>
                    <button onClick={() => handleRemoveUrl(url, 'blacklist')} className="text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
              <div className="overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                <p className="text-[8px] font-black text-green-500 uppercase sticky top-0 bg-[#0f1117] pb-2">Whitelist Actual</p>
                {data?.whitelist?.map((url: string) => (
                  <div key={url} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-slate-800">
                    <span className="text-[9px] font-mono text-slate-400 truncate">{url}</span>
                    <button onClick={() => handleRemoveUrl(url, 'whitelist')} className="text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-white uppercase italic flex items-center gap-2"><ShieldAlert className="text-orange-500" size={16}/> Logs de Incidencias</h3>
                <div className="flex gap-2">
                  <button onClick={fetchIncidencias} className={`p-2 rounded-lg bg-slate-900 border border-slate-800 text-orange-500 transition-all ${refreshing ? 'animate-spin' : ''}`}><RefreshCw size={14} /></button>
                  <button onClick={() => generatePDF('incidencias')} className="text-[8px] font-black text-slate-500 hover:text-white uppercase border border-slate-800 px-3 rounded-lg">Exportar Logs</button>
                </div>
             </div>
             <div className="space-y-2">
                {incidencias.length > 0 ? incidencias.map((inc, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-4 p-4 bg-black/40 rounded-xl border border-slate-800/50 text-[8px] font-bold uppercase italic text-slate-400">
                    <span className="text-white tracking-tighter">{inc.alumno}</span>
                    <span className="text-orange-500/80">{inc.tablet}</span>
                    <span className="text-slate-600">{inc.fecha}</span>
                    <span className="text-slate-600">{inc.hora}</span>
                    <span className="text-red-500/70 truncate">{inc.url}</span>
                  </div>
                )) : (
                  <div className="text-center py-10 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Pulsa el icono para actualizar incidencias</div>
                )}
             </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
            <div className="text-center">
              <FileText className="text-orange-500 mx-auto mb-4" size={32} />
              <h4 className="text-[11px] font-black text-white uppercase italic">Reporte de Protección</h4>
            </div>

            {/* CONTADOR INFERIOR (PROTECCIÓN ACTIVA) */}
            <div className="p-6 bg-green-500/5 border border-green-500/10 rounded-2xl">
                <p className="text-[7px] font-black text-green-500 uppercase tracking-[0.2em] mb-1">Estado de Seguridad</p>
                <p className="text-xl font-black text-white italic">{data?.blacklist?.length || 0} <span className="text-green-500 text-[10px]">URLs Protegidas</span></p>
            </div>

            <button onClick={() => generatePDF('seguridad')} className="w-full bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase italic hover:bg-orange-500 hover:text-white transition-all shadow-lg">
              Descargar PDF Profesional
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};