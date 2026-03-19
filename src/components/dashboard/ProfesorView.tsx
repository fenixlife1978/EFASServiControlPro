'use client';

import React, { useState, useEffect } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { 
  collection, query, where, onSnapshot, doc, getDoc 
} from 'firebase/firestore';
import { 
  ref, onValue, update, serverTimestamp as rtdbTimestamp 
} from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  History, User, RefreshCw, AlertTriangle, Search, Lock, Unlock, Globe, ShieldAlert, ZapOff
} from 'lucide-react';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { AlertFeed } from '@/components/dashboard/IncidentsTable';
import { toast } from 'sonner';

// --- INTERFAZ DE DATOS ---
interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  aulaId?: string;
  seccion?: string;
  status?: string;
  current_url?: string;
  ultimaUrl?: string;
  cortarNavegacion?: boolean;
  blockAllBrowsing?: boolean; // Añadido para consistencia con handleBlindaje
  shieldMode?: boolean;
  online?: boolean;
  ultimoAcceso?: any;
  InstitutoId?: string;
  rol?: string;
  lastUpdated?: any;
}

export default function ProfesorView() {
  const [alumnos, setAlumnos] = useState<Dispositivo[]>([]);
  const [nombreSede, setNombreSede] = useState('Cargando...');
  const [datosProfesor, setDatosProfesor] = useState({ nombre: '...', rol: '...', aulaId: '', seccion: '' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  const [workingInstitutoId, setWorkingInstitutoId] = useState<string>('');
  const [isBlindando, setIsBlindando] = useState(false);

  // 1. Obtener InstitutoId del localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('InstitutoId');
      if (id) setWorkingInstitutoId(id);
    }
  }, []);

  // 2. Carga de Perfil del Profesor y Escucha de Alumnos del Aula
  useEffect(() => {
    if (!workingInstitutoId) return;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        // Query para obtener datos del profesor en Firestore
        const qProf = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        
        const unsubProf = onSnapshot(qProf, (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            // Limpieza de strings para evitar errores de comparación
            const seccionLimpia = (data.seccion || '').toString().replace(/["']/g, '').replace('SECCION ', '').trim();
            
            setDatosProfesor({
              nombre: data.nombre || 'Docente',
              rol: data.role || 'Profesor',
              aulaId: data.aulaId || '',
              seccion: seccionLimpia
            });

            // ESCUCHA RTDB: Sincronización en tiempo real de los dispositivos
            const dispositivosRef = ref(rtdb, `dispositivos`);
            const unsubRTDB = onValue(dispositivosRef, (snapshot) => {
              const dataRTDB = snapshot.val();
              if (dataRTDB) {
                const listaFiltrada = Object.keys(dataRTDB)
                  .map(key => ({ id: key, ...dataRTDB[key] } as Dispositivo))
                  .filter(d => 
                    d.InstitutoId === workingInstitutoId && 
                    d.aulaId === data.aulaId && 
                    d.rol === "alumno" &&
                    (d.seccion || '').toString().replace('SECCION ', '').trim() === seccionLimpia
                  );
                setAlumnos(listaFiltrada);
              } else {
                setAlumnos([]);
              }
              setLoading(false);
            });

            return () => unsubRTDB();
          }
        });

        // Obtener nombre de la institución
        const instRef = doc(db, "institutions", workingInstitutoId);
        getDoc(instRef).then(s => s.exists() && setNombreSede(s.data().nombre));

        return () => unsubProf();
      }
    });

    return () => unsubAuth();
  }, [workingInstitutoId]);

  // 3. Acción de Blindaje Masivo
  const handleBlindajeAula = async (bloquear: boolean) => {
    if (alumnos.length === 0) return;
    
    setIsBlindando(true);
    const toastId = toast.loading(bloquear ? "Blindando aula..." : "Liberando navegación...");

    try {
      const updates: any = {};
      alumnos.forEach(alumno => {
        updates[`/dispositivos/${alumno.id}/cortarNavegacion`] = bloquear;
        updates[`/dispositivos/${alumno.id}/blockAllBrowsing`] = bloquear;
        updates[`/dispositivos/${alumno.id}/lastUpdated`] = rtdbTimestamp();
      });

      await update(ref(rtdb), updates);
      toast.success(bloquear ? "Aula blindada" : "Navegación restaurada", { id: toastId });
    } catch (error) {
      console.error("Error Blindaje:", error);
      toast.error("Error en la operación masiva", { id: toastId });
    } finally {
      setIsBlindando(false);
    }
  };

  // 4. Acción Individual
  const handleToggleBlock = async (tabletId: string, isBlocked: boolean) => {
    if (!tabletId) return;
    try {
      const updates: any = {};
      updates[`/dispositivos/${tabletId}/cortarNavegacion`] = !isBlocked;
      updates[`/dispositivos/${tabletId}/blockAllBrowsing`] = !isBlocked;
      updates[`/dispositivos/${tabletId}/lastUpdated`] = rtdbTimestamp();
      await update(ref(rtdb), updates);
    } catch (e) { console.error("Error individual block:", e); }
  };

  const checkIsOnline = (ultimoAcceso: any) => {
    if (!ultimoAcceso) return false;
    const lastSeenTime = typeof ultimoAcceso === 'number' ? ultimoAcceso : new Date(ultimoAcceso).getTime();
    return (Date.now() - lastSeenTime) < 30000;
  };

  // 5. Filtros y Cálculos de UI
  const alumnosFiltrados = alumnos.filter(al => 
    al.alumno_asignado?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAlumnos = alumnos.length;
  const totalBloqueados = alumnos.filter(al => al.cortarNavegacion).length;
  const todosBloqueados = totalAlumnos > 0 && totalBloqueados === totalAlumnos;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-h-[60vh]">
      
      {/* HEADER CON CONTROLES */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-800 pb-8">
        <div>
          <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2 italic">Panel de Control Docente</h2>
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

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            onClick={() => handleBlindajeAula(!todosBloqueados)}
            disabled={isBlindando || totalAlumnos === 0}
            className={`flex flex-col items-center justify-center px-6 py-3 rounded-2xl transition-all border-2 shadow-xl min-w-[200px] ${
              todosBloqueados
                ? 'bg-red-600/10 border-red-500 text-red-500 hover:bg-red-600 hover:text-white'
                : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {todosBloqueados ? <Unlock size={16} /> : <ZapOff size={16} />}
              <span className="text-[10px] font-black uppercase italic tracking-tighter">
                {isBlindando ? 'PROCESANDO...' : todosBloqueados ? 'LIBERAR NAVEGACIÓN' : 'BLINDAR TODA EL AULA'}
              </span>
            </div>
            
            <div className={`text-[9px] font-bold px-3 py-0.5 rounded-full ${
              todosBloqueados ? 'bg-red-500 text-white' : 'bg-white/20 text-white'
            }`}>
              {totalBloqueados} / {totalAlumnos} BLOQUEADOS
            </div>
          </button>

          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input 
              type="text"
              placeholder="BUSCAR ESTUDIANTE..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-10 pr-4 text-white text-[9px] font-black uppercase outline-none focus:border-blue-500 transition-all"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* GRID DE ESTUDIANTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><RefreshCw className="animate-spin text-blue-500 mx-auto" /></div>
        ) : alumnosFiltrados.length > 0 ? (
          alumnosFiltrados.map((al) => {
            const online = checkIsOnline(al.ultimoAcceso);
            const urlActual = al.ultimaUrl || al.current_url || 'Navegador inactivo';
            
            return (
              <div key={al.id} className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl hover:border-blue-500/50 transition-all group">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`} />
                    <h3 className="text-[11px] font-black text-white uppercase italic">{al.alumno_asignado}</h3>
                  </div>
                  {al.shieldMode && <ShieldAlert size={14} className="text-orange-500 animate-bounce" />}
                </div>
                
                <div className="bg-black/40 p-3 rounded-2xl border border-slate-800/50 mb-4 flex items-center gap-2 group-hover:border-blue-500/30 transition-colors">
                  <Globe size={12} className="text-slate-600" />
                  <p className="text-[10px] text-blue-400 font-bold truncate lowercase flex-1">{urlActual}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setHistoryModal({ isOpen: true, tabletId: al.id, alumnoNombre: al.alumno_asignado || 'Estudiante' })} 
                    className="bg-slate-800 hover:bg-slate-700 p-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <History size={14} className="text-blue-400" />
                    <span className="text-[9px] font-black text-white uppercase italic tracking-tighter">Historial</span>
                  </button>
                  
                  <button 
                    onClick={() => handleToggleBlock(al.id, al.cortarNavegacion || false)}
                    className={`p-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                      al.cortarNavegacion 
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                        : 'bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white'
                    }`}
                  >
                    {al.cortarNavegacion ? <Lock size={14} /> : <Unlock size={14} />}
                    <span className="text-[9px] font-black uppercase italic">
                      {al.cortarNavegacion ? 'Bloqueado' : 'Bloquear'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-32 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem] text-center">
             <AlertTriangle size={32} className="text-slate-700 mx-auto mb-4" />
             <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest px-4">
                No hay tablets activas en {datosProfesor.aulaId} {datosProfesor.seccion}
             </p>
          </div>
        )}
      </div>

      <AlertFeed aulaId={datosProfesor.aulaId} institutoId={workingInstitutoId} />
      
      <WebHistoryModal 
        isOpen={historyModal.isOpen} 
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} 
        deviceId={historyModal.tabletId} 
        alumnoNombre={historyModal.alumnoNombre} 
      />
    </div>
  );
}
