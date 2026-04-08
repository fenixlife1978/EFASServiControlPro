'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { 
  collection, query, where, onSnapshot, doc, getDoc 
} from 'firebase/firestore';
import { 
  ref, onValue, update, off
} from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  History, User, Search, Globe, Shield, LogOut, ShieldCheck, ShieldX
} from 'lucide-react';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { toast } from 'sonner';

interface Dispositivo {
  id: string;
  alumno_asignado?: string;
  aulaId?: string;
  seccion?: string;
  ultimaUrl?: string;
  shield_mode_enable?: boolean;
  block_mode_local?: boolean;
  rol?: string;
}

interface RealtimeStatus {
  lastSeen?: number;
  url_actual?: string;
  shield_mode_enable?: boolean;
  block_mode_local?: boolean;
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
  const [isActuando, setIsActuando] = useState(false);
  const [actuandoTotal, setActuandoTotal] = useState(false);
  
  // Estados locales para UI inmediata
  const [localBlockMode, setLocalBlockMode] = useState<Record<string, boolean>>({});
  const [localShieldMode, setLocalShieldMode] = useState<Record<string, boolean>>({});
  
  const actuandoRef = useRef<Set<string>>(new Set());

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

  // Escuchar status_dispositivos
  useEffect(() => {
    if (!workingInstitutoId) return;

    const statusRef = ref(rtdb, 'status_dispositivos');
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const map: Record<string, RealtimeStatus> = {};
        Object.entries(data).forEach(([deviceId, info]: [string, any]) => {
          map[deviceId] = {
            lastSeen: info.lastSeen,
            url_actual: info.url_actual,
            shield_mode_enable: info.shield_mode_enable === true,
            block_mode_local: info.block_mode_local === true
          };
          setLocalShieldMode(prev => ({ ...prev, [deviceId]: info.shield_mode_enable === true }));
          setLocalBlockMode(prev => ({ ...prev, [deviceId]: info.block_mode_local === true }));
        });
        setRealtimeStatusMap(map);
      }
    });

    return () => off(statusRef);
  }, [workingInstitutoId]);

  // Cargar perfil del profesor
  useEffect(() => {
    if (!workingInstitutoId) return;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const qProf = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        
        const unsubProf = onSnapshot(qProf, (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            const seccionLimpia = (data.seccion || "").toString().replace(/["']/g, "").replace("SECCION ", "").trim();

            setDatosProfesor({
              nombre: data.nombre || "Docente",
              rol: data.role || "Profesor",
              aulaId: data.aulaId || "",
              seccion: seccionLimpia
            });
          }
        });
        
        return () => unsubProf();
      }
    });

    return () => unsubAuth();
  }, [workingInstitutoId]);

  // Cargar nombre de la sede
  useEffect(() => {
    if (!workingInstitutoId) return;
    const instRef = doc(db, "institutions", workingInstitutoId);
    getDoc(instRef).then(snap => {
      if (snap.exists()) setNombreSede(snap.data()?.nombre || "Sede Principal");
    });
  }, [workingInstitutoId]);

  // Escuchar dispositivos del aula del profesor
  useEffect(() => {
    if (!workingInstitutoId || !datosProfesor.aulaId) return;

    setLoading(true);
    const dispositivosRef = ref(rtdb, 'dispositivos');
    
    const unsubscribe = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const alumnosList: Dispositivo[] = [];
        Object.entries(data).forEach(([id, device]: [string, any]) => {
          if (device.InstitutoId === workingInstitutoId && 
              device.rol === 'alumno' && 
              device.aulaId === datosProfesor.aulaId &&
              (!datosProfesor.seccion || device.seccion === datosProfesor.seccion)) {
            alumnosList.push({
              id,
              alumno_asignado: device.alumno_asignado || 'Sin nombre',
              aulaId: device.aulaId,
              seccion: device.seccion,
              ultimaUrl: device.ultimaUrl || '',
              shield_mode_enable: device.shield_mode_enable || false,
              block_mode_local: device.block_mode_local || false,
              rol: device.rol
            });
          }
        });
        setAlumnos(alumnosList);
        setLoading(false);
      } else {
        setAlumnos([]);
        setLoading(false);
      }
    });

    return () => off(dispositivosRef);
  }, [workingInstitutoId, datosProfesor.aulaId, datosProfesor.seccion]);

  // BLOQUEO INDIVIDUAL (block_mode_local) - Todos los roles pueden
  const toggleBlockModeLocal = async (deviceId: string, currentState: boolean) => {
    if (actuandoRef.current.has(deviceId)) return;
    
    actuandoRef.current.add(deviceId);
    setIsActuando(true);
    
    const newState = !currentState;
    setLocalBlockMode(prev => ({ ...prev, [deviceId]: newState }));
    
    try {
      const blockRef = ref(rtdb, `status_dispositivos/${deviceId}/block_mode_local`);
      await update(blockRef, { block_mode_local: newState });
      
      toast.success(newState ? '✅ Bloqueo individual activado' : '🔓 Bloqueo individual desactivado');
    } catch (error) {
      setLocalBlockMode(prev => ({ ...prev, [deviceId]: currentState }));
      console.error('Error:', error);
      toast.error('Error al cambiar bloqueo individual');
    } finally {
      actuandoRef.current.delete(deviceId);
      setIsActuando(false);
    }
  };

  // BLOQUEO TOTAL DEL AULA (shield_mode_enable) - Solo el profesor puede (sobre su aula)
  const toggleShieldModeAula = async () => {
    if (actuandoTotal) return;
    
    setActuandoTotal(true);
    const dispositivosAAfectar = alumnosFiltrados;
    
    if (dispositivosAAfectar.length === 0) {
      toast.warning('No hay dispositivos en esta aula');
      setActuandoTotal(false);
      return;
    }
    
    const todosBloqueados = dispositivosAAfectar.every(a => 
      getShieldModeState(a.id) === true
    );
    const nuevoEstado = !todosBloqueados;
    
    // UI optimista
    const updates: Record<string, boolean> = {};
    for (const alumno of dispositivosAAfectar) {
      updates[alumno.id] = nuevoEstado;
    }
    setLocalShieldMode(prev => ({ ...prev, ...updates }));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const alumno of dispositivosAAfectar) {
      try {
        const shieldRef = ref(rtdb, `status_dispositivos/${alumno.id}/shield_mode_enable`);
        await update(shieldRef, { shield_mode_enable: nuevoEstado });
        successCount++;
      } catch (error) {
        setLocalShieldMode(prev => ({ ...prev, [alumno.id]: !nuevoEstado }));
        failCount++;
        console.error(`Error:`, error);
      }
    }
    
    if (successCount > 0) {
      toast.success(
        nuevoEstado 
          ? `🔒 Aula bloqueada: ${successCount}/${dispositivosAAfectar.length} dispositivos`
          : `🔓 Aula desbloqueada: ${successCount}/${dispositivosAAfectar.length} dispositivos`
      );
    }
    if (failCount > 0) {
      toast.error(`❌ Error en ${failCount} dispositivos`);
    }
    
    setActuandoTotal(false);
  };

  const alumnosFiltrados = alumnos.filter(alumno =>
    alumno.alumno_asignado?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alumno.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDeviceStatus = (deviceId: string) => {
    const rtStatus = realtimeStatusMap[deviceId];
    const lastSeen = rtStatus?.lastSeen;
    const online = lastSeen ? (Date.now() - lastSeen) < 45000 : false;
    return { online, urlActual: rtStatus?.url_actual || '' };
  };

  const getBlockModeState = (deviceId: string): boolean => {
    if (localBlockMode[deviceId] !== undefined) return localBlockMode[deviceId];
    return realtimeStatusMap[deviceId]?.block_mode_local === true;
  };

  const getShieldModeState = (deviceId: string): boolean => {
    if (localShieldMode[deviceId] !== undefined) return localShieldMode[deviceId];
    return realtimeStatusMap[deviceId]?.shield_mode_enable === true;
  };

  const verHistorial = (deviceId: string, alumnoNombre: string) => {
    setHistoryModal({ isOpen: true, tabletId: deviceId, alumnoNombre });
  };

  const dispositivosBloqueadosAula = alumnosFiltrados.filter(a => getShieldModeState(a.id) === true).length;
  const totalDispositivos = alumnosFiltrados.length;
  const hayBloqueadosAula = dispositivosBloqueadosAula > 0;

  return (
    <div className="p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-black min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black italic bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">
            Panel del Profesor
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {nombreSede} | {datosProfesor.aulaId} - {datosProfesor.seccion}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Botón de bloqueo total del AULA - Solo profesor */}
          <button
            onClick={toggleShieldModeAula}
            disabled={actuandoTotal || loading || totalDispositivos === 0}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${
              hayBloqueadosAula 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hayBloqueadosAula ? 'Desbloquear toda el aula' : 'Bloquear toda el aula'}
          >
            {hayBloqueadosAula ? <ShieldX size={14} /> : <ShieldCheck size={14} />}
            {hayBloqueadosAula ? 'DESBLOQUEAR AULA' : 'BLOQUEAR AULA'}
            <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-[9px]">
              {dispositivosBloqueadosAula}/{totalDispositivos}
            </span>
          </button>
          
          <div className="text-right">
            <p className="text-white text-sm font-bold">{datosProfesor.nombre}</p>
            <p className="text-orange-500 text-[10px] font-black uppercase">{datosProfesor.rol}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </div>

      {/* Indicador de estado del aula */}
      {totalDispositivos > 0 && (
        <div className={`mb-4 p-3 rounded-xl flex items-center justify-between ${
          hayBloqueadosAula ? 'bg-red-500/20 border border-red-500/30' : 'bg-green-500/20 border border-green-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {hayBloqueadosAula ? <ShieldX size={16} className="text-red-400" /> : <ShieldCheck size={16} className="text-green-400" />}
            <span className="text-xs font-medium">
              {hayBloqueadosAula ? '⚠️ Aula bloqueada' : '✅ Aula sin bloqueos'}
            </span>
          </div>
          <div className="text-xs font-mono">
            <span className={hayBloqueadosAula ? 'text-red-400' : 'text-green-400'}>
              {dispositivosBloqueadosAula}
            </span>
            <span className="text-slate-500">/{totalDispositivos}</span>
            <span className="text-slate-500 ml-2">dispositivos bloqueados</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Buscar alumno por nombre o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
        </div>
      ) : alumnosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/30 rounded-2xl">
          <User className="text-slate-600 mx-auto mb-2" size={48} />
          <p className="text-slate-500 text-sm">No hay alumnos asignados a tu aula</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alumnosFiltrados.map((alumno) => {
            const { online, urlActual } = getDeviceStatus(alumno.id);
            const blockModeEnabled = getBlockModeState(alumno.id);
            const shieldModeEnabled = getShieldModeState(alumno.id);
            
            const isBlocked = blockModeEnabled || shieldModeEnabled;
            
            return (
              <div
                key={alumno.id}
                className={`bg-slate-900/50 border rounded-2xl p-4 hover:border-orange-500/50 transition-all group ${
                  isBlocked ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                    <h3 className={`text-sm font-bold ${isBlocked ? 'text-red-400' : 'text-white'}`}>
                      {alumno.alumno_asignado}
                    </h3>
                    {shieldModeEnabled && (
                      <span className="text-[8px] bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full">
                        AULA
                      </span>
                    )}
                    {blockModeEnabled && !shieldModeEnabled && (
                      <span className="text-[8px] bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded-full">
                        INDIV
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {/* Botón de bloqueo INDIVIDUAL - Todos los roles pueden */}
                    <button
                      onClick={() => toggleBlockModeLocal(alumno.id, blockModeEnabled)}
                      disabled={isActuando || actuandoRef.current.has(alumno.id) || shieldModeEnabled}
                      className={`p-1.5 rounded-lg transition-all ${
                        blockModeEnabled 
                          ? 'bg-red-500 text-white hover:bg-red-600' 
                          : 'bg-green-500 text-white hover:bg-green-600'
                      } ${shieldModeEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={shieldModeEnabled ? 'Dispositivo bloqueado por aula' : (blockModeEnabled ? 'Desactivar bloqueo individual' : 'Activar bloqueo individual')}
                    >
                      <Shield size={14} />
                    </button>
                    <button
                      onClick={() => verHistorial(alumno.id, alumno.alumno_asignado || 'Alumno')}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-orange-500 transition-all"
                      title="Ver historial web"
                    >
                      <History size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="text-[10px] text-slate-500 space-y-1">
                  <p>ID: {alumno.id.slice(-8)}</p>
                  <p>Aula: {alumno.aulaId} - {alumno.seccion}</p>
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-[10px]">
                    <Globe size={10} className="text-slate-500" />
                    <p className="text-slate-400 truncate flex-1">
                      {urlActual || alumno.ultimaUrl || 'Sin actividad'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WebHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })}
        deviceId={historyModal.tabletId}
        alumnoNombre={historyModal.alumnoNombre}
        institutoId={workingInstitutoId}
      />
    </div>
  );
}