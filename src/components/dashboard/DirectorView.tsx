'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/firebase/config';
import { 
  collection, onSnapshot, query, where, orderBy, doc, getDoc, getDocs, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Users, Tablet, Layout, Search, GraduationCap, Briefcase, Activity, User, X, FileText, Printer, 
  Globe, Eye, ShieldCheck, RefreshCw, Zap, Flame, AlertTriangle, Send, MessageSquare, Lock, ShieldAlert
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';

export default function DirectorView() {
  const [profesores, setProfesores] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [sesionesActivas, setSesionesActivas] = useState<any[]>([]);
  const [nombreInstituto, setNombreInstituto] = useState('Cargando...');
  const [nombreDirector, setNombreDirector] = useState('Cargando...');
  const [showReport, setShowReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [aulaSeleccionada, setAulaSeleccionada] = useState<any>(null);
  const [alumnosAula, setAlumnosAula] = useState<any[]>([]);
  const [lastPulse, setLastPulse] = useState<string>('');

  const [messageModal, setMessageModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '', text: '' });
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  
  // Usamos estrictamente "InstitutoId" como en tu DB
  const getInstitutoId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('InstitutoId') || '';
    }
    return '';
  };

  const workingInstitutoId = getInstitutoId();

  const fetchMonitorDocente = useCallback(async () => {
    if (!workingInstitutoId) return;
    setIsRefreshing(true);
    try {
      const qSesiones = query(
        collection(db, "sesiones_monitoreo"), 
        where("InstitutoId", "==", workingInstitutoId),
        where("role", "==", "profesor")
      );
      const snapshot = await getDocs(qSesiones);
      setSesionesActivas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error en sesiones_monitoreo:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [workingInstitutoId]);

  useEffect(() => {
    if (!workingInstitutoId) return;

    // 1. Nombre de la Institución
    const fetchNombreInst = async () => {
      try {
        const instRef = doc(db, "institutions", workingInstitutoId);
        const instSnap = await getDoc(instRef);
        if (instSnap.exists()) setNombreInstituto(instSnap.data().nombre || "Sede EDU");
      } catch (err) { console.error("Error instituciones:", err); }
    };
    fetchNombreInst();

    // 2. Nombre del Director
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        const qDir = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        onSnapshot(qDir, (snap) => {
          if (!snap.empty) setNombreDirector(snap.docs[0].data().nombre || 'Director');
        }, (err) => console.error("Error usuarios dir:", err));
      }
    });

    // 3. Profesores
    const qProf = query(
        collection(db, "usuarios"), 
        where("InstitutoId", "==", workingInstitutoId), 
        where("role", "==", "profesor")
    );
    const unsubProf = onSnapshot(qProf, (s) => {
      setProfesores(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error profesores:", err));

    // 4. Aulas (CORREGIDO: Apuntando a subcolección y usando campos existentes según imagen)
    const qAulas = query(
        collection(db, "institutions", workingInstitutoId, "Aulas"), 
        orderBy("aulaId") 
    );
    const unsubAulas = onSnapshot(qAulas, (s) => {
      setAulas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
        console.error("Error aulas:", err);
        // Fallback en caso de que el índice de orderBy tarde en propagarse
        const qAulasSimple = query(collection(db, "institutions", workingInstitutoId, "Aulas"));
        onSnapshot(qAulasSimple, (s) => {
            setAulas(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    });

    // 5. Dispositivos
    const qDev = query(
        collection(db, "dispositivos"), 
        where("InstitutoId", "==", workingInstitutoId)
    );
    const unsubDev = onSnapshot(qDev, (s) => {
      setDispositivos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error dispositivos:", err));

    fetchMonitorDocente();

    return () => { unsubAuth(); unsubProf(); unsubAulas(); unsubDev(); };
  }, [workingInstitutoId, fetchMonitorDocente]);

  // Supervisión táctica de aula
  useEffect(() => {
    if (!aulaSeleccionada || !workingInstitutoId) return;
    const qSup = query(
      collection(db, "sesiones_monitoreo"),
      where("InstitutoId", "==", workingInstitutoId),
      where("aulaId", "==", aulaSeleccionada.aulaId) // Usamos aulaId del documento
    );
    const unsubSup = onSnapshot(qSup, (s) => {
      setAlumnosAula(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastPulse(new Date().toLocaleTimeString());
    }, (err) => console.error("Error monitoreo aula:", err));
    return () => unsubSup();
  }, [aulaSeleccionada, workingInstitutoId]);

  const handleSendMessage = async () => {
    if (!messageModal.tabletId || !messageModal.text.trim()) return;
    try {
      await updateDoc(doc(db, "dispositivos", messageModal.tabletId), {
        pending_message: messageModal.text,
        message_timestamp: serverTimestamp(),
        message_sender: "Dirección Institucional"
      });
      setMessageModal({ ...messageModal, isOpen: false, text: '' });
    } catch (e) { console.error(e); }
  };

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
      pdf.save(`EDU_Reporte_${new Date().getTime()}.pdf`);
    } catch (error) { console.error(error); }
  };

  const alerts = dispositivos.filter(t => t.last_url?.includes('block') || t.status === 'restricted');

  if (!workingInstitutoId) return <div className="p-10 text-red-500 font-black italic uppercase">Acceso Denegado. No se encontró InstitutoId.</div>;

  return (
    <div className="animate-in fade-in duration-500 p-4 lg:p-0 relative space-y-8">
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

      {/* SECCIÓN TÁCTICA */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xs font-black italic uppercase text-white mb-6 flex items-center gap-3"><Lock className="text-orange-500 w-4 h-4" /> Control Maestro</h2>
              <div className="scale-90 origin-left"><GlobalControls institutionId={workingInstitutoId} /></div>
            </div>

            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest italic flex items-center gap-2">
                    <Flame size={14} className="text-orange-500" /> Riesgos de Navegación
                  </h3>
               </div>
               <div className="space-y-3">
                  {alerts.length > 0 ? alerts.slice(0, 4).map((alert, i) => (
                    <div key={i} className="bg-red-500/5 p-4 rounded-2xl border border-red-500/10 group hover:border-red-500/30 transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[9px] font-black text-white uppercase italic">{alert.alumno_asignado || 'Estudiante'}</p>
                            <AlertTriangle size={12} className="text-red-500 animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between">
                           <p className="text-[8px] font-bold text-slate-600 uppercase truncate max-w-[120px]">{alert.last_url || 'BLOQUEADO'}</p>
                           <div className="flex gap-2">
                             <button onClick={() => setHistoryModal({ isOpen: true, tabletId: alert.id, alumnoNombre: alert.alumno_asignado })} className="text-slate-500 hover:text-white"><Globe size={12}/></button>
                             <button onClick={() => setMessageModal({ isOpen: true, tabletId: alert.id, alumnoNombre: alert.alumno_asignado, text: '' })} className="text-[8px] font-black text-orange-500 uppercase hover:text-white">Notificar</button>
                           </div>
                        </div>
                    </div>
                  )) : (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-3xl">
                        <ShieldCheck size={24} className="text-slate-800 mx-auto mb-2" />
                        <p className="text-[9px] font-black text-slate-600 uppercase italic">Sin Infracciones</p>
                    </div>
                  )}
               </div>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
            <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl h-full">
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
                    {isRefreshing ? 'Sincronizando...' : 'Sincronizar'}
                </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <p className="text-[9px] font-black uppercase italic">Esperando actividad docente...</p>
                    </div>
                )}
                </div>
            </section>
        </div>
      </div>

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

      {/* SUPERVISIÓN PERSONAL */}
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
                      <p className="text-white font-black text-[11px] uppercase italic group-hover:text-orange-500 transition-colors">
                        {a.aulaId}
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase italic">Sección: {a.seccion}</p>
                    </div>
                    <Eye size={16} className="text-slate-700 group-hover:text-orange-500 transition-colors" />
                  </button>
                ))}
              </div>
           </section>
        </div>
      </div>

      {/* MODAL SUPERVISIÓN LIVE AULA */}
      {aulaSeleccionada && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#0f1117] border border-slate-800 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-black/40 text-white">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500 p-3 rounded-2xl animate-pulse shadow-lg shadow-orange-500/20"><Layout size={24} /></div>
                <div>
                  <h3 className="font-black italic uppercase text-lg">{aulaSeleccionada.aulaId} - {aulaSeleccionada.seccion}</h3>
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

      {/* MODAL REPORTE */}
      {showReport && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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

      {/* MODAL MENSAJERÍA */}
      {messageModal.isOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-black italic uppercase text-white tracking-tighter mb-4 flex items-center gap-2">
                <ShieldAlert className="text-blue-500" size={20} /> Aviso de <span className="text-blue-500">Dirección</span>
            </h2>
            <textarea 
              placeholder="ESCRIBA EL COMUNICADO..." 
              className="w-full bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white font-bold text-xs uppercase min-h-[140px] outline-none focus:border-blue-500 mb-6" 
              value={messageModal.text} 
              onChange={(e) => setMessageModal({...messageModal, text: e.target.value})} 
            />
            <div className="flex gap-2">
               <button onClick={handleSendMessage} className="flex-1 bg-blue-600 p-5 rounded-xl font-black uppercase text-white text-xs">Enviar Alerta</button>
               <button onClick={() => setMessageModal({...messageModal, isOpen: false})} className="p-5 text-[9px] font-black uppercase text-slate-600">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <WebHistoryModal 
        isOpen={historyModal.isOpen} 
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} 
        tabletId={historyModal.tabletId} 
        alumnoNombre={historyModal.alumnoNombre} 
      />
    </div>
  );
}
