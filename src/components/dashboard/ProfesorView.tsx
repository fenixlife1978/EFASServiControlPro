'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { 
  collection, query, where, onSnapshot, doc, getDoc 
} from 'firebase/firestore';
import { 
  ref, onValue, update, off, serverTimestamp as rtdbTimestamp 
} from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  History, User, RefreshCw, AlertTriangle, Search, Lock, Unlock, 
  Globe, ShieldAlert, ZapOff, Wifi, WifiOff, LogOut,
  ShieldX
} from 'lucide-react';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { toast } from 'sonner';

interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  aulaId?: string;
  seccion?: string;
  status?: string;
  current_url?: string;
  ultimaUrl?: string;
  shield_mode_enable?: boolean;
  online?: boolean;
  ultimoAcceso?: number;
  lastSeen?: number;
  InstitutoId?: string;
  rol?: string;
}

interface RealtimeStatus {
  lastSeen?: number;
  url_actual?: string;
  estado?: string;
  shield_mode_enable?: boolean;
  admin_mode_enable?: boolean;
}

export default function ProfesorView() {
  const [alumnos, setAlumnos] = useState<Dispositivo[]>([]);
  const [realtimeStatusMap, setRealtimeStatusMap] = useState<Record<string, RealtimeStatus>>({});
  const [nombreSede, setNombreSede] = useState('Cargando...');
  const [datosProfesor, setDatosProfesor] = useState({ nombre: '...', rol: '...', aulaId: '', seccion: '' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  const [workingInstitutoId, setWorkingInstitutoId] = useState<string>('');
  const [isBlindando, setIsBlindando] = useState(false);
  
  const bloqueandoRef = useRef<Set<string>>(new Set());

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('InstitutoId');
      window.location.href = '/login';
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('InstitutoId');
      if (id) setWorkingInstitutoId(id);
    }
  }, []);

  useEffect(() => {
    if (!workingInstitutoId) return;

    const statusRef = ref(rtdb, 'status_dispositivos');
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const map: Record<string, RealtimeStatus> = {};
        Object.entries(data).forEach(([deviceId, info]: [string, any]) => {
          map[deviceId] = {
            lastSeen: info.lastSeen || info.ultimoAcceso,
            url_actual: info.url_actual,
            estado: info.estado,
            shield_mode_enable: info.shield_mode_enable,
            admin_mode_enable: info.admin_mode_enable
          };
        });
        setRealtimeStatusMap(map);
      }
    });

    return () => off(statusRef);
  }, [workingInstitutoId]);

  useEffect(() => {
    if (!workingInstitutoId) return;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const qProf = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        
        const unsubProf = onSnapshot(qProf, (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const seccionLimpia = (data.seccion || '').toString().replace(/["']/g, '').replace('SECCION ', '').trim();
            
            setDatosProfesor({
              nombre: data.nombre || 'Docente',
              rol: data.role || 'Profesor',
              aulaId: data.aulaId || '',
              seccion: seccionLimpia
            });

            const dispositivosRef = ref(rtdb, `dispositivos`);
            const unsubRTDB = onValue(dispositivosRef, (snapshot) => {
              const dataRTDB = snapshot.val();
              if (dataRTDB) {
                const listaFiltrada = Object.keys(dataRTDB)
                  .map(key => ({ id: key, ...dataRTDB[key] } as Dispositivo))
                  .filter(d => 
                    d.InstitutoId === workingInstitutoId && 
                    d.aulaId === datosProfesor.aulaId && 
                    d.rol === "alumno" &&
                    (d.seccion || '').toString().replace('SECCION ', '').trim() === seccionLimpia
                  );
                
                setAlumnos(listaFiltrada);
              } else {
                setAlumnos([]);
              }
              setLoading(false);
            });

            return () => {
              off(dispositivosRef);
            };
          }
        });

        const instRef = doc(db, "institutions", workingInstitutoId);
        getDoc(instRef).then(s => s.exists() && setNombreSede(s.data().nombre));

        return () => {
          unsubProf();
        };
      }
    });

    return () => {
      unsubAuth();
    };
  }, [workingInstitutoId, datosProfesor.aulaId]);

  const handleBlindajeAula = async (bloquear: boolean) => {
    if (alumnos.length === 0) return;
    
    setIsBlindando(true);
    const toastId = toast.loading(bloquear ? "🛡️ Blindando aula..." : "🔓 Liberando navegación...");

    try {
      const updates: any = {};
      alumnos.forEach(alumno => {
        updates[`/dispositivos/${alumno.id}/shield_mode_enable`] = bloquear;
        updates[`/status_dispositivos/${alumno.id}/shield_mode_enable`] = bloquear;
        updates[`/dispositivos/${alumno.id}/lastUpdated`] = rtdbTimestamp();
        updates[`/status_dispositivos/${alumno.id}/last_command_ts`] = Date.now();
      });

      await update(ref(rtdb), updates);
      toast.success(bloquear ? "🛡️ Aula blindada con éxito" : "🔓 Navegación restaurada en el aula", { id: toastId });
    } catch (error) {
      console.error("Error Blindaje:", error);
      toast.error("❌ Error en la operación masiva", { id: toastId });
    } finally {
      setIsBlindando(false);
    }
  };

  const handleToggleBlock = async (alumno: Dispositivo) => {
    const deviceId = alumno.id;
    const nombreAlumno = alumno.alumno_asignado || 'Estudiante';
    const currentStatus = isDeviceBlocked(deviceId);
    const nuevoEstado = !currentStatus;
    
    if (bloqueandoRef.current.has(deviceId)) {
      toast.info("Procesando acción...");
      return;
    }
    
    bloqueandoRef.current.add(deviceId);
    
    try {
      const updates: any = {};
      updates[`/dispositivos/${deviceId}/shield_mode_enable`] = nuevoEstado;
      updates[`/status_dispositivos/${deviceId}/shield_mode_enable`] = nuevoEstado;
      updates[`/dispositivos/${deviceId}/lastUpdated`] = rtdbTimestamp();
      updates[`/status_dispositivos/${deviceId}/last_command_ts`] = Date.now();
      
      await update(ref(rtdb), updates);
      toast.success(nuevoEstado ? `🔒 ${nombreAlumno} bloqueado` : `🔓 ${nombreAlumno} liberado`);
      
    } catch (error) {
      console.error("Error en bloqueo individual:", error);
      toast.error("❌ Error al procesar la acción");
    } finally {
      setTimeout(() => {
        bloqueandoRef.current.delete(deviceId);
      }, 1000);
    }
  };

  const checkIsOnline = (deviceId: string) => {
    const rtInfo = realtimeStatusMap[deviceId];
    const lastSeen = rtInfo?.lastSeen;
    if (!lastSeen) return false;
    return (Date.now() - lastSeen) < 45000;
  };

  const getCurrentUrl = (deviceId: string) => {
    const rtInfo = realtimeStatusMap[deviceId];
    return rtInfo?.url_actual || 'Navegador inactivo';
  };

  const isDeviceBlocked = (deviceId: string) => {
    const rtInfo = realtimeStatusMap[deviceId];
    if (rtInfo?.shield_mode_enable !== undefined) {
      return rtInfo.shield_mode_enable;
    }
    const device = alumnos.find(a => a.id === deviceId);
    return device?.shield_mode_enable || false;
  };

  const alumnosFiltrados = alumnos.filter(al => 
    al.alumno_asignado?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAlumnos = alumnos.length;
  const totalBloqueados = alumnos.filter(al => isDeviceBlocked(al.id)).length;
  const todosBloqueados = totalAlumnos > 0 && totalBloqueados === totalAlumnos;

  if (!loading && (!datosProfesor.aulaId || !datosProfesor.seccion)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={48} className="text-orange-500 mb-4" />
        <h2 className="text-xl font-black text-white uppercase italic mb-2">Sin Aula Asignada</h2>
        <p className="text-slate-400 text-sm max-w-md">
          El profesor {datosProfesor.nombre} no tiene un aula asignada. Contacta al administrador para configurar tu perfil.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <RefreshCw className="animate-spin text-orange-500 w-8 h-8" />
        <span className="ml-3 text-slate-500 text-xs font-black uppercase">Cargando panel docente...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-h-[60vh]">
      
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

          <button
            onClick={handleLogout}
            className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"
          >
            <LogOut size={14} /> Cerrar Sesión
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {alumnosFiltrados.length > 0 ? (
          alumnosFiltrados.map((al) => {
            const online = checkIsOnline(al.id);
            const urlActual = getCurrentUrl(al.id);
            const isBlocked = isDeviceBlocked(al.id);
            
            return (
              <div key={al.id} className={`bg-[#0f1117] border rounded-[2.5rem] p-6 shadow-2xl hover:border-blue-500/50 transition-all group ${
                isBlocked ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    {online ? (
                      <Wifi size={12} className="text-green-500" />
                    ) : (
                      <WifiOff size={12} className="text-slate-600" />
                    )}
                    <h3 className="text-[11px] font-black text-white uppercase italic">{al.alumno_asignado || 'Sin asignar'}</h3>
                  </div>
                  {isBlocked && <ShieldX size={14} className="text-red-500 animate-pulse" />}
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
                    onClick={() => handleToggleBlock(al)}
                    className={`p-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                      isBlocked 
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/20 hover:bg-green-700' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {isBlocked ? <Lock size={14} /> : <ShieldX size={14} />}
                    <span className="text-[9px] font-black uppercase italic">
                      {isBlocked ? 'DESBLOQUEAR' : 'BLOQUEAR'}
                    </span>
                  </button>
                </div>
                
                {isBlocked && (
                  <div className="mt-3 text-center">
                    <span className="text-[8px] text-red-400 font-black uppercase tracking-wider">
                      ⚠️ DISPOSITIVO BLOQUEADO
                    </span>
                  </div>
                )}
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
      
      <WebHistoryModal 
        isOpen={historyModal.isOpen} 
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} 
        deviceId={historyModal.tabletId} 
        alumnoNombre={historyModal.alumnoNombre} 
      />
    </div>
  );
}