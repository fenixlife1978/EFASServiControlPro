'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '@/firebase/config';
import { 
  collection, onSnapshot, query, where, doc, getDoc, 
  updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  History, User, RefreshCw, AlertTriangle, Search, Lock, Unlock 
} from 'lucide-react';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { AlertFeed } from '@/components/dashboard/AlertFeed';

// Definimos la interfaz para evitar errores de TypeScript
interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  aulaId?: string;
  seccion?: string;
  status?: string;
  current_url?: string;
  navegacion_bloqueada?: boolean;
  InstitutoId?: string;
  rol?: string;
}

export default function ProfesorView() {
  const [alumnos, setAlumnos] = useState<Dispositivo[]>([]);
  const [nombreSede, setNombreSede] = useState('Cargando...');
  const [datosProfesor, setDatosProfesor] = useState({ nombre: '...', rol: '...', aulaId: '', seccion: '' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  const [workingInstitutoId, setWorkingInstitutoId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('InstitutoId');
      if (id) setWorkingInstitutoId(id);
    }
  }, []);

  useEffect(() => {
    if (!workingInstitutoId) return;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const qProf = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        
        const unsubProf = onSnapshot(qProf, (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            // Limpieza de strings para comparación flexible
            const seccionLimpia = (data.seccion || '').toString().replace(/["']/g, '').replace('SECCION ', '').trim();
            
            setDatosProfesor({
              nombre: data.nombre || 'Docente',
              rol: data.role || 'Profesor',
              aulaId: data.aulaId || '',
              seccion: seccionLimpia
            });

            const qAlumnos = query(
              collection(db, "dispositivos"),
              where("InstitutoId", "==", workingInstitutoId),
              where("aulaId", "==", data.aulaId),
              where("rol", "==", "alumno")
            );

            const unsubAlumnos = onSnapshot(qAlumnos, (alumnoSnap) => {
              const docs = alumnoSnap.docs.map(d => ({ id: d.id, ...d.data() } as Dispositivo))
                .filter(d => {
                   const sDB = (d.seccion || '').toString().replace(/["']/g, '').replace('SECCION ', '').trim();
                   return sDB === seccionLimpia;
                });
              
              setAlumnos(docs);
              setLoading(false);
            }, (err) => {
              console.error("Error en query dispositivos:", err);
              setLoading(false);
            });

            return () => unsubAlumnos();
          }
        });

        const instRef = doc(db, "institutions", workingInstitutoId);
        getDoc(instRef).then(s => s.exists() && setNombreSede(s.data().nombre));
        return () => unsubProf();
      }
    });

    return () => unsubAuth();
  }, [workingInstitutoId]);

  const handleToggleBlock = async (tabletId: string, isBlocked: boolean) => {
    if (!tabletId) return;
    try {
      await updateDoc(doc(db, "dispositivos", tabletId), {
        navegacion_bloqueada: !isBlocked,
        lastUpdated: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  };

  const alumnosFiltrados = alumnos.filter(al => 
    al.alumno_asignado?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-h-[60vh]">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><RefreshCw className="animate-spin text-blue-500 mx-auto" /></div>
        ) : alumnosFiltrados.length > 0 ? (
          alumnosFiltrados.map((al) => (
            <div key={al.id} className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl hover:border-blue-500/50 transition-all">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${al.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                  <h3 className="text-[11px] font-black text-white uppercase italic">{al.alumno_asignado}</h3>
                </div>
              </div>
              <div className="bg-black/40 p-3 rounded-2xl border border-slate-800/50 mb-6 text-center">
                <p className="text-[10px] text-blue-400 font-bold truncate lowercase">{al.current_url || 'Sin actividad'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setHistoryModal({ isOpen: true, tabletId: al.id, alumnoNombre: al.alumno_asignado || 'Estudiante' })} className="bg-slate-800 p-3 rounded-xl flex items-center justify-center gap-2">
                  <History size={14} className="text-blue-400" />
                  <span className="text-[9px] font-black text-white uppercase italic tracking-tighter">Historial</span>
                </button>
                <button 
                  onClick={() => handleToggleBlock(al.id, al.navegacion_bloqueada || false)}
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
             <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest px-4">
                No hay tablets vinculadas a {datosProfesor.aulaId} - {datosProfesor.seccion}
             </p>
          </div>
        )}
      </div>

      <AlertFeed aulaId={datosProfesor.aulaId} institutoId={workingInstitutoId} />
      <WebHistoryModal isOpen={historyModal.isOpen} onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} tabletId={historyModal.tabletId} alumnoNombre={historyModal.alumnoNombre} />
    </div>
  );
}
