'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/firebase/config';
import { 
  collection, onSnapshot, query, where, orderBy, doc, getDoc, getDocs 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Users, Tablet, Layout, Search, GraduationCap, Briefcase, Activity, User, X, FileText, Printer, Globe, Eye, ShieldCheck, RefreshCw, Zap
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function DirectorView() {
  const [profesores, setProfesores] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [sesionesActivas, setSesionesActivas] = useState<any[]>([]);
  const [nombreInstituto, setNombreInstituto] = useState('Cargando...');
  const [nombreDirector, setNombreDirector] = useState('Cargando...');
  const [showReport, setShowReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados para supervisión táctica de aulas
  const [aulaSeleccionada, setAulaSeleccionada] = useState<any>(null);
  const [alumnosAula, setAlumnosAula] = useState<any[]>([]);
  const [lastPulse, setLastPulse] = useState<string>('');
  
  const institutoId = typeof window !== 'undefined' ? (localStorage.getItem('InstitutoId') ?? '') : '';

  // Función para actualización manual (Ahorro de Lecturas)
  const fetchMonitorDocente = useCallback(async () => {
    if (!institutoId) return;
    setIsRefreshing(true);
    try {
      const qSesiones = query(
        collection(db, "sesiones_monitoreo"), 
        where("InstitutoId", "==", institutoId),
        where("rol", "==", "profesor")
      );
      const snapshot = await getDocs(qSesiones);
      setSesionesActivas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error en pulso manual:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [institutoId]);

  useEffect(() => {
    if (!institutoId) return;

    const fetchNombreInst = async () => {
      try {
        const instRef = doc(db, "institutions", institutoId);
        const instSnap = await getDoc(instRef);
        if (instSnap.exists()) setNombreInstituto(instSnap.data().nombre || "Sede EFAS");
      } catch (err) { setNombreInstituto("Sede EFAS"); }
    };
    fetchNombreInst();

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        const qDir = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        const unsubDir = onSnapshot(qDir, (snap) => {
          if (!snap.empty) setNombreDirector(snap.docs[0].data().nombre || 'Director');
        });
        return () => unsubDir();
      }
    });

    // Carga inicial de datos base (poca frecuencia de cambio)
    const qProf = query(collection(db, "usuarios"), where("InstitutoId", "==", institutoId), where("rol", "==", "profesor"));
    const unsubProf = onSnapshot(qProf, (s) => setProfesores(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qAulas = query(collection(db, `institutions/${institutoId}/Aulas`), orderBy("nombre_completo"));
    const unsubAulas = onSnapshot(qAulas, (s) => setAulas(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qDev = query(collection(db, "dispositivos"), where("InstitutoId", "==", institutoId));
    const unsubDev = onSnapshot(qDev, (s) => setDispositivos(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Ejecutar carga inicial del monitor
    fetchMonitorDocente();

    return () => { unsubAuth(); unsubProf(); unsubAulas(); unsubDev(); };
  }, [institutoId, fetchMonitorDocente]);

  // Supervisión Live de Alumnos (Solo se activa al abrir el modal)
  useEffect(() => {
    if (!aulaSeleccionada || !institutoId) return;
    const qSup = query(
      collection(db, "sesiones_monitoreo"),
      where("InstitutoId", "==", institutoId),
      where("aulaId", "==", aulaSeleccionada.id)
    );
    const unsubSup = onSnapshot(qSup, (s) => {
      setAlumnosAula(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastPulse(new Date().toLocaleTimeString());
    });
    return () => unsubSup();
  }, [aulaSeleccionada, institutoId]);

  const exportToPDF = async () => {
    const element = document.getElementById('report-content');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { backgroundColor: '#0f1117', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`EFAS_Reporte_${new Date().getTime()}.pdf`);
    } catch (error) { console.error(error); }
  };

  if (!institutoId) return <div className="p-10 text-red-500 font-black italic uppercase">Acceso Denegado.</div>;

  return (
    <div className="animate-in fade-in duration-500 p-4 lg:p-0 relative space-y-8">
      
      {/* MODAL SUPERVISIÓN INVISIBLE DE AULA */}
      {aulaSeleccionada && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#0f1117] border border-slate-800 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-black/40 text-white">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500 p-3 rounded-2xl animate-pulse shadow-lg shadow-orange-500/20"><Layout size={24} /></div>
                <div>
                  <h3 className="font-black italic uppercase text-lg">{aulaSeleccionada.nombre_completo}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-orange-500 font-black uppercase italic tracking-widest">Monitoreo Live</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Último Pulso: {lastPulse}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setAulaSeleccionada(null)} className="hover:bg-red-500 p-2 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {alumnosAula.length > 0 ? alumnosAula.map(al => (
                <div key={al.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-bold text-xs uppercase">{al.usuario}</span>
                    <span className="text-[9px] text-slate-600 font-black italic">TABLET: {al.tabletId}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-xl border border-slate-800/50">
                    <p className="text-[10px] text-blue-400 font-medium truncate">{al.url_actual || 'Pestaña del Sistema'}</p>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-20 text-center text-slate-500 font-black uppercase italic text-xs">Sin tráfico detectado en este aula</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REPORTE */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f1117] border border-slate-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div id="report-content" className="p-8 space-y-6 bg-[#0f1117]">
               <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <h3 className="text-white font-black italic uppercase text-lg tracking-tighter">Status Report</h3>
                  <button onClick={() => setShowReport(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-800/50 pb-2 text-[10px] font-black uppercase italic">
                    <span className="text-slate-500">Director</span>
                    <span className="text-white">{nombreDirector}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-2 text-[10px] font-black uppercase italic">
                    <span className="text-slate-500">Sede</span>
                    <span className="text-white">{nombreInstituto}</span>
                  </div>
               </div>
            </div>
            <div className="p-8 pt-0 grid grid-cols-2 gap-3">
              <button onClick={() => window.print()} className="bg-slate-800 text-white font-black uppercase italic text-[10px] py-4 rounded-2xl flex items-center justify-center gap-2">
                <Printer size={14} /> Imprimir
              </button>
              <button onClick={exportToPDF} className="bg-orange-500 text-white font-black uppercase italic text-[10px] py-4 rounded-2xl flex items-center justify-center gap-2">
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] mb-2 italic">Director Management</h2>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">{nombreInstituto}</h1>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 pr-4 rounded-2xl border border-slate-800 w-fit">
            <div className="bg-orange-500/20 p-2 rounded-xl text-orange-500"><User size={16} /></div>
            <div className="flex flex-col">
              <span className="text-white text-[10px] font-bold uppercase leading-tight">{nombreDirector}</span>
              <span className="text-orange-500 text-[9px] font-black uppercase italic tracking-[0.15em] mt-0.5">Director de Sede</span>
            </div>
          </div>
        </div>
        <button onClick={() => setShowReport(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic transition-all flex items-center gap-2 border border-slate-700 shadow-xl">
          <Activity size={14} className="text-orange-500" /> Exportar Status
        </button>
      </header>

      {/* MONITOR DOCENTE (ACTUALIZACIÓN MANUAL) */}
      <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="p-8 border-b border-slate-800 bg-black/40 flex justify-between items-center">
          <h3 className="text-xs font-black text-white uppercase italic flex items-center gap-2">
            <Globe className="text-orange-500" size={16} /> Monitor Docente
          </h3>
          <button 
            onClick={fetchMonitorDocente}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase italic transition-all ${isRefreshing ? 'bg-slate-800 text-slate-500' : 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:scale-105'}`}
          >
            {isRefreshing ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
            {isRefreshing ? 'Sincronizando...' : 'Sincronizar Monitor'}
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[150px]">
          {sesionesActivas.length > 0 ? sesionesActivas.map(sesion => (
            <div key={sesion.id} className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl group">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500"><Briefcase size={16} /></div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase italic">{sesion.usuario}</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase">ID: {sesion.tabletId}</p>
                </div>
              </div>
              <div className="bg-black/40 p-3 rounded-2xl border border-slate-800/50">
                <p className="text-[10px] text-blue-400 font-bold truncate lowercase">{sesion.url_actual || 'efas-control.pro'}</p>
              </div>
            </div>
          )) : (
            <div className="col-span-full flex flex-col items-center justify-center py-10 text-slate-600">
              <RefreshCw size={24} className="mb-2 opacity-20" />
              <p className="text-[9px] font-black uppercase italic">Pulsa sincronizar para ver actividad docente</p>
            </div>
          )}
        </div>
      </section>

      {/* STATS RÁPIDOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0f1117] border border-slate-800 p-6 rounded-[2rem] flex items-center gap-5">
           <Briefcase className="text-blue-500" size={24} />
           <div><p className="text-[9px] font-black text-slate-500 uppercase italic">Docentes</p><p className="text-2xl font-black text-white italic">{profesores.length}</p></div>
        </div>
        <div className="bg-[#0f1117] border border-slate-800 p-6 rounded-[2rem] flex items-center gap-5">
           <Layout className="text-orange-500" size={24} />
           <div><p className="text-[9px] font-black text-slate-500 uppercase italic">Aulas</p><p className="text-2xl font-black text-white italic">{aulas.length}</p></div>
        </div>
        <div className="bg-[#0f1117] border border-slate-800 p-6 rounded-[2rem] flex items-center gap-5">
           <Tablet className="text-green-500" size={24} />
           <div><p className="text-[9px] font-black text-slate-500 uppercase italic">Dispositivos</p><p className="text-2xl font-black text-white italic">{dispositivos.length}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8">
          <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-black/20">
              <h3 className="text-xs font-black text-white uppercase italic flex items-center gap-2">
                <Users className="text-orange-500" size={16} /> Supervisión de Personal
              </h3>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] font-black text-slate-600 uppercase italic">
                    <th className="p-4">Nombre / Email</th>
                    <th className="p-4">Terminal ID</th>
                    <th className="p-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {profesores.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.03] text-[10px]">
                      <td className="p-4">
                        <p className="text-white font-bold uppercase">{p.nombre || 'Sin nombre'}</p>
                        <p className="text-slate-500">{p.email}</p>
                      </td>
                      <td className="p-4 font-black uppercase italic text-blue-500">{p.tabletId || '---'}</td>
                      <td className="p-4">
                        <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-1 rounded-lg text-[8px] font-black uppercase italic">Adscrito</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div className="col-span-12 lg:col-span-4">
           <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="text-orange-500" size={18} />
                <h3 className="text-xs font-black text-white uppercase italic">Supervisión de Aulas</h3>
              </div>
              <div className="space-y-3">
                {aulas.map(a => (
                  <button 
                    key={a.id} 
                    onClick={() => setAulaSeleccionada(a)}
                    className="w-full bg-slate-900/30 border border-slate-800 p-4 rounded-2xl flex justify-between items-center border-l-4 border-l-orange-500 hover:bg-orange-500/5 transition-all group"
                  >
                    <div className="text-left">
                      <p className="text-white font-black text-[11px] uppercase italic group-hover:text-orange-500 transition-colors">{a.nombre_completo}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase italic">{a.nivel} - {a.seccion}</p>
                    </div>
                    <Eye size={16} className="text-slate-700 group-hover:text-orange-500 transition-colors" />
                  </button>
                ))}
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
