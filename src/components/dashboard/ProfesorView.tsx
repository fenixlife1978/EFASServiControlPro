'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '@/firebase/config';
import { 
  collection, onSnapshot, query, where, doc, getDoc, 
  updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Users, Tablet, Globe, ShieldAlert, Lock, Unlock, 
  History, User, RefreshCw, Zap, AlertTriangle, Search
} from 'lucide-react';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { AlertFeed } from '@/components/dashboard/AlertFeed';

export default function ProfesorView() {
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [nombreSede, setNombreSede] = useState('Cargando...');
  const [datosProfesor, setDatosProfesor] = useState({ nombre: '...', rol: '...', aulaId: '', seccion: '' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });

  const getInstitutoId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('InstitutoId') || '';
    }
    return '';
  };

  const workingInstitutoId = getInstitutoId();

  useEffect(() => {
    if (!workingInstitutoId) return;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        // 1. Obtener datos del profesor incluyendo SECCIÓN
        const qProf = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        onSnapshot(qProf, (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const aulaAsignada = data.aulaId || '';
            const seccionAsignada = data.seccion || '';
            
            setDatosProfesor({
              nombre: data.nombre || 'Docente',
              rol: data.role || 'Profesor',
              aulaId: aulaAsignada,
              seccion: seccionAsignada
            });

            // 2. Monitoreo de Alumnos filtrando por Aula Y Sección
            const qAlumnos = query(
              collection(db, "sesiones_monitoreo"),
              where("InstitutoId", "==", workingInstitutoId),
              where("aulaId", "==", aulaAsignada),
              where("seccion", "==", seccionAsignada),
              where("role", "==", "alumno")
            );

            const unsubAlumnos = onSnapshot(qAlumnos, (alumnoSnap) => {
              setAlumnos(alumnoSnap.docs.map(d => ({ id: d.id, ...d.data() })));
              setLoading(false);
            }, (err) => {
              console.error("Error en query alumnos:", err);
              setLoading(false);
            });
          }
        });

        const instRef = doc(db, "institutions", workingInstitutoId);
        getDoc(instRef).then(s => s.exists() && setNombreSede(s.data().nombre));
      }
    });

    return () => unsubAuth();
  }, [workingInstitutoId]);

  const handleToggleBlock = async (tabletId: string, isBlocked: boolean) => {
    if (!tabletId) return;
    try {
      const devRef = doc(db, "dispositivos", tabletId);
      await updateDoc(devRef, {
        navegacion_bloqueada: !isBlocked,
        updatedAt: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  };

  const alumnosFiltrados = alumnos.filter(al => 
    al.usuario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-h-[60vh]">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-800 pb-8">
        <div>
          <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2 italic">Docente en Línea</h2>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">{nombreSede}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-900/50 p-2 pr-4 rounded-2xl border border-slate-800 flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-xl text-blue-500"><User size={16} /></div>
              <span className="text-white text-[10px] font-bold uppercase">{datosProfesor.nombre}</span>
            </div>
            <div className="bg-blue-600/20 border border-blue-500/30 p-2 px-4 rounded-xl flex items-center gap-2">
              <span className="text-blue-400 text-[10px] font-black uppercase italic">Aula: {datosProfesor.aulaId}</span>
              <span className="w-1 h-1 rounded-full bg-blue-500/40" />
              <span className="text-blue-400 text-[10px] font-black uppercase italic">Sección: {datosProfesor.seccion}</span>
            </div>
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input 
            type="text"
            placeholder="BUSCAR ESTUDIANTE..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white text-[9px] font-black uppercase outline-none focus:border-blue-500 transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* GRID DE ALUMNOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><RefreshCw className="animate-spin text-blue-500 mx-auto" /></div>
        ) : alumnosFiltrados.length > 0 ? (
          alumnosFiltrados.map((al) => (
            <div key={al.id} className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl hover:border-blue-500/50 transition-all">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${al.online ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                  <h3 className="text-[11px] font-black text-white uppercase italic">{al.usuario}</h3>
                </div>
              </div>

              <div className="bg-black/40 p-3 rounded-2xl border border-slate-800/50 mb-6">
                <p className="text-[10px] text-blue-400 font-bold truncate lowercase text-center">{al.url_actual || 'Sin actividad'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setHistoryModal({ isOpen: true, tabletId: al.tabletId, alumnoNombre: al.usuario })} className="bg-slate-800 p-3 rounded-xl flex items-center justify-center gap-2">
                  <History size={14} className="text-blue-400" />
                  <span className="text-[9px] font-black text-white uppercase italic">Log</span>
                </button>
                <button 
                  onClick={() => handleToggleBlock(al.tabletId, al.navegacion_bloqueada)}
                  className={`p-3 rounded-xl flex items-center justify-center gap-2 ${al.navegacion_bloqueada ? 'bg-red-500 text-white' : 'bg-blue-600/10 text-blue-500 border border-blue-500/20'}`}
                >
                  {al.navegacion_bloqueada ? <Lock size={14} /> : <Unlock size={14} />}
                  <span className="text-[9px] font-black uppercase italic">{al.navegacion_bloqueada ? 'Locked' : 'Block'}</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem] text-center">
             <AlertTriangle size={32} className="text-slate-700 mx-auto mb-4" />
             <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">
                No hay estudiantes en {datosProfesor.aulaId} - SECCIÓN {datosProfesor.seccion}
             </p>
          </div>
        )}
      </div>

      <AlertFeed aulaId={datosProfesor.aulaId} institutoId={workingInstitutoId} />
      <WebHistoryModal isOpen={historyModal.isOpen} onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} tabletId={historyModal.tabletId} alumnoNombre={historyModal.alumnoNombre} />
    </div>
  );
}
