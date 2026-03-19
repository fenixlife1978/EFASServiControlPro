'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { ref, onValue, set, serverTimestamp as rtdbTimestamp } from 'firebase/database';
import { 
  collection, onSnapshot, query, where, orderBy, doc, getDoc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Users, Tablet, Layout, Activity, User, X, FileText, Printer, 
  Globe, Eye, ShieldCheck, Lock, ShieldAlert, Briefcase
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Componentes del sistema
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { IncidentsTable } from '@/components/admin/security/IncidentsTable';

interface Dispositivo {
  id: string;
  aulaId?: string;
  rol?: string;
  alumno_asignado?: string;
  online?: boolean;
  ultimaUrl?: string;
  InstitutoId?: string;
  [key: string]: any;
}

interface Aula {
  id: string;
  aulaId: string;
  seccion: string;
  [key: string]: any;
}

export default function DirectorView() {
  const [profesores, setProfesores] = useState<any[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [nombreInstituto, setNombreInstituto] = useState('Cargando...');
  const [nombreDirector, setNombreDirector] = useState('Cargando...');
  const [showReport, setShowReport] = useState(false);
  
  const [aulaSeleccionada, setAulaSeleccionada] = useState<Aula | null>(null);
  const [lastPulse, setLastPulse] = useState<string>('');
  const [workingInstitutoId, setWorkingInstitutoId] = useState<string>('');

  const [messageModal, setMessageModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '', text: '' });
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  const [realtimeMonitoring, setRealtimeMonitoring] = useState<any>({});

  // 1. Obtener InstitutoId con useEffect para evitar errores de hidratación
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('InstitutoId');
      if (id) setWorkingInstitutoId(id);
    }
  }, []);

  // 2. Carga de datos principales
  useEffect(() => {
    if (!workingInstitutoId) return;

    // Cargar Nombre de Institución
    const instRef = doc(db, "institutions", workingInstitutoId);
    getDoc(instRef).then(s => s.exists() && setNombreInstituto(s.data().nombre || "Sede Principal"));

    // Suscripción a Director
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        const qDir = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        onSnapshot(qDir, (snap) => {
          if (!snap.empty) setNombreDirector(snap.docs[0].data().nombre || 'Director');
        });
      }
    });

    // Suscripción a Profesores
    const qProf = query(collection(db, "usuarios"), where("InstitutoId", "==", workingInstitutoId), where("role", "==", "profesor"));
    const unsubProf = onSnapshot(qProf, (s) => setProfesores(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Suscripción a Aulas
    const qAulas = query(collection(db, "institutions", workingInstitutoId, "Aulas"), orderBy("aulaId"));
    const unsubAulas = onSnapshot(qAulas, (s) => setAulas(s.docs.map(d => ({ id: d.id, ...d.data() })) as Aula[]));

    // Suscripción a TODOS los Dispositivos de la Sede (Para contadores y live)
    const qDev = query(collection(db, "dispositivos"), where("InstitutoId", "==", workingInstitutoId));
    const unsubDev = onSnapshot(qDev, (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() })) as Dispositivo[];
      setDispositivos(docs);
    });

    // Monitoreo Realtime
    const rtRef = ref(rtdb, `monitoring/${workingInstitutoId}`);
    const unsubRTDB = onValue(rtRef, (snapshot) => {
      if (snapshot.exists()) {
        setRealtimeMonitoring(snapshot.val());
        setLastPulse(new Date().toLocaleTimeString());
      }
    });

    return () => { unsubAuth(); unsubProf(); unsubAulas(); unsubDev(); unsubRTDB(); };
  }, [workingInstitutoId]);

  // 3. Filtrado reactivo de alumnos para el modal de aula
  const alumnosAula = useMemo(() => {
    if (!aulaSeleccionada) return [];
    return dispositivos.filter(d => 
      String(d.aulaId).trim() === String(aulaSeleccionada.aulaId).trim() && 
      d.rol === 'alumno'
    );
  }, [dispositivos, aulaSeleccionada]);

  const checkIsOnline = (deviceId: string, firestoreOnline: boolean) => {
    const rtInfo = realtimeMonitoring[deviceId];
    if (rtInfo && rtInfo.lastActive) {
      return (Date.now() - rtInfo.lastActive) < 45000;
    }
    return firestoreOnline;
  };

  const handleSendMessage = async () => {
    if (!messageModal.tabletId || !messageModal.text.trim()) return;
    try {
      await set(ref(rtdb, `commands/${messageModal.tabletId}/message`), {
        text: messageModal.text,
        sender: "Dirección Institucional",
        timestamp: rtdbTimestamp()
      });
      setMessageModal({ ...messageModal, isOpen: false, text: '' });
    } catch (e) { console.error(e); }
  };

  if (!workingInstitutoId) return <div className="p-20 text-center text-slate-500 font-black animate-pulse">AUTENTICANDO SEDE...</div>;

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
        <button onClick={() => setShowReport(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic flex items-center gap-2 border border-slate-700 shadow-xl transition-all">
          <Activity size={14} className="text-orange-500" /> Exportar Status
        </button>
      </header>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xs font-black italic uppercase text-white mb-6 flex items-center gap-3"><Lock className="text-orange-500 w-4 h-4" /> Control Maestro</h2>
              <div className="scale-90 origin-left">
                <GlobalControls institutionId={workingInstitutoId} />
              </div>
            </div>
            
            <div className="bg-[#0f1117] border border-slate-800 p-6 rounded-[2rem] flex items-center gap-5">
              <div className="bg-green-500/10 p-4 rounded-2xl text-green-500">
                <Tablet size={28} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase italic">Dispositivos en Red</p>
                <p className="text-3xl font-black text-white italic">{dispositivos.length}</p>
              </div>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
            <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl h-full">
                <div className="p-8 border-b border-slate-800 bg-black/40 flex justify-between items-center">
                  <h3 className="text-xs font-black text-white uppercase italic flex items-center gap-2">
                      <Globe className="text-orange-500" size={16} /> Monitor Docente
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto">
                  {profesores.map(prof => {
                      const rtDev = realtimeMonitoring[prof.tabletId];
                      const fsDev = dispositivos.find(d => d.id === prof.tabletId);
                      const online = checkIsOnline(prof.tabletId, fsDev?.online || false);
                      return (
                        <div key={prof.id} className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl group">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500"><Briefcase size={16} /></div>
                              <p className="text-[10px] font-black text-white uppercase italic truncate">{prof.nombre}</p>
                          </div>
                          <div className="bg-black/40 p-3 rounded-2xl border border-slate-800/50 flex items-center justify-between">
                              <p className="text-[9px] text-blue-400 font-bold truncate lowercase flex-1">
                                {rtDev?.currentUrl || fsDev?.ultimaUrl || 'Sin actividad'}
                              </p>
                              <span className={`ml-2 w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                          </div>
                        </div>
                      );
                  })}
                </div>
            </section>
        </div>
      </div>

      {/* TABLA DE INFRACCIONES */}
      <IncidentsTable 
        institutionId={workingInstitutoId}
        onViewHistory={(deviceId, alumnoNombre) => setHistoryModal({ isOpen: true, tabletId: deviceId, alumnoNombre })}
        onSendMessage={(deviceId, alumnoNombre) => setMessageModal({ isOpen: true, tabletId: deviceId, alumnoNombre, text: '' })}
      />

      {/* SUPERVISIÓN POR AULAS */}
      <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="text-orange-500" size={18} />
          <h3 className="text-xs font-black text-white uppercase italic">Supervisión de Aulas</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {aulas.map(a => (
            <button 
              key={a.id} 
              onClick={() => setAulaSeleccionada(a)}
              className="bg-slate-900/30 border border-slate-800 p-4 rounded-2xl flex flex-col items-center gap-2 border-l-4 border-l-orange-500 hover:bg-orange-500/10 transition-all group"
            >
              <p className="text-white font-black text-[11px] uppercase italic group-hover:text-orange-500">{a.aulaId}</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase">{a.seccion}</p>
              <Eye size={14} className="text-slate-700 group-hover:text-orange-500" />
            </button>
          ))}
        </div>
      </section>

      {/* MODAL MONITOR LIVE AULA */}
      {aulaSeleccionada && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#0f1117] border border-slate-800 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-black/40 text-white">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500 p-3 rounded-2xl animate-pulse"><Layout size={24} /></div>
                <div>
                  <h3 className="font-black italic uppercase text-lg">{aulaSeleccionada.aulaId} - {aulaSeleccionada.seccion}</h3>
                  <span className="text-[10px] text-orange-500 font-black uppercase italic tracking-widest">Live: {lastPulse}</span>
                </div>
              </div>
              <button onClick={() => setAulaSeleccionada(null)} className="hover:bg-red-500 p-2 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alumnosAula.length > 0 ? alumnosAula.map(alumno => {
                const rtInfo = realtimeMonitoring[alumno.id];
                const online = checkIsOnline(alumno.id, alumno.online || false);
                return (
                  <div key={alumno.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-bold text-xs uppercase truncate pr-2">{alumno.alumno_asignado || 'Sin nombre'}</span>
                      <span className="text-[9px] text-slate-600 font-black">...{alumno.id.slice(-4).toUpperCase()}</span>
                    </div>
                    <div className="bg-black/40 p-3 rounded-xl border border-slate-800/50 flex items-center justify-between">
                      <p className="text-[10px] text-blue-400 font-medium truncate flex-1">{rtInfo?.currentUrl || alumno.ultimaUrl || 'En espera...'}</p>
                      <span className={`ml-2 w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-full py-20 text-center text-slate-500 font-black uppercase italic text-xs">No se detectan alumnos configurados en el aula {aulaSeleccionada.aulaId}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPONENTES DE APOYO */}
      <WebHistoryModal 
        isOpen={historyModal.isOpen} 
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} 
        deviceId={historyModal.tabletId}
        alumnoNombre={historyModal.alumnoNombre} 
      />
    </div>
  );
}