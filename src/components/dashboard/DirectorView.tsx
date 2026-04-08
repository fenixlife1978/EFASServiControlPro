'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { ref, get, set, serverTimestamp as rtdbTimestamp, off, onValue } from 'firebase/database';
import { 
  collection, onSnapshot, query, where, orderBy, doc, getDoc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  Users, Tablet, Layout, Activity, User, X, FileText, Printer, 
  Globe, Eye, ShieldCheck, Lock, ShieldAlert, Briefcase, LogOut
} from 'lucide-react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { toast } from "sonner"; 
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { ConsultasInfracciones } from '@/components/dashboard/ConsultasInfracciones';
import { MonitorDocente } from '@/components/admin/monitoreo/MonitorDocente';

interface Dispositivo {
  id: string;
  aulaId?: string;
  rol?: string;
  alumno_asignado?: string;
  online?: boolean;
  ultimaUrl?: string;
  InstitutoId?: string;
  estado?: string;
  admin_mode_enable?: boolean;
  shield_mode_enable?: boolean;
  seccion?: string;
  [key: string]: any;
}

interface Aula {
  id: string;
  aulaId: string;
  seccion: string;
  [key: string]: any;
}

interface RealtimeStatus {
  lastSeen?: number;
  url_actual?: string;
  estado?: string;
  admin_mode_enable?: boolean;
  shield_mode_enable?: boolean;
}

export default function DirectorView() {
  const { institutionId, userRole, loadingPermissions } = useInstitution();
  const [profesores, setProfesores] = useState<any[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [realtimeStatusMap, setRealtimeStatusMap] = useState<Record<string, RealtimeStatus>>({});
  const [nombreInstituto, setNombreInstituto] = useState('Cargando...');
  const [nombreDirector, setNombreDirector] = useState('Cargando...');
  
  const [aulaSeleccionada, setAulaSeleccionada] = useState<Aula | null>(null);
  const [lastPulse, setLastPulse] = useState<string>('');

  const [messageModal, setMessageModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '', text: '' });
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  
  // OPTIMIZACIÓN: Ref para controlar montaje/desmontaje
  const isMounted = useRef(true);
  // OPTIMIZACIÓN: Cache de deviceIds de la institución para filtrar más rápido
  const deviceIdsCache = useRef<Set<string>>(new Set());

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('InstitutoId');
      window.location.href = '/login';
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // OPTIMIZACIÓN: Actualizar cache cuando cambian los dispositivos
  useEffect(() => {
    const newCache = new Set<string>();
    dispositivos.forEach(d => newCache.add(d.id));
    deviceIdsCache.current = newCache;
  }, [dispositivos]);

  // 1. Escuchar estado en tiempo real desde RTDB (OPTIMIZADO: filtrar por cache)
  useEffect(() => {
    if (!institutionId) return;

    const statusRef = ref(rtdb, 'status_dispositivos');
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (!isMounted.current) return;
      
      const data = snapshot.val();
      if (data) {
        const map: Record<string, RealtimeStatus> = {};
        // OPTIMIZACIÓN: Solo procesar dispositivos que están en cache
        Object.entries(data).forEach(([deviceId, info]: [string, any]) => {
          if (deviceIdsCache.current.has(deviceId)) {
            map[deviceId] = {
              lastSeen: info.lastSeen || info.ultimoAcceso,
              url_actual: info.url_actual,
              estado: info.estado,
              admin_mode_enable: info.admin_mode_enable,
              shield_mode_enable: info.shield_mode_enable
            };
          }
        });
        setRealtimeStatusMap(map);
        setLastPulse(new Date().toLocaleTimeString());
      }
    });

    return () => {
      off(statusRef);
    };
  }, [institutionId]);

  // 2. Cargar datos desde Firestore (OPTIMIZADO: sin cambios funcionales)
  useEffect(() => {
    if (!institutionId) return;

    // Cargar Nombre de Institución
    const instRef = doc(db, "institutions", institutionId);
    getDoc(instRef).then(s => s.exists() && setNombreInstituto(s.data()?.nombre || "Sede Principal"));

    // Suscripción a Director
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        const qDir = query(collection(db, "usuarios"), where("email", "==", user.email.toLowerCase()));
        const unsubDir = onSnapshot(qDir, (snap) => {
          if (!snap.empty) setNombreDirector(snap.docs[0].data().nombre || 'Director');
        });
        return () => unsubDir();
      }
    });

    // Suscripción a Profesores
    const qProf = query(collection(db, "usuarios"), where("InstitutoId", "==", institutionId), where("role", "==", "profesor"));
    const unsubProf = onSnapshot(qProf, (s) => setProfesores(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Suscripción a Aulas
    const qAulas = query(collection(db, "institutions", institutionId, "Aulas"), orderBy("aulaId"));
    const unsubAulas = onSnapshot(qAulas, (s) => setAulas(s.docs.map(d => ({ id: d.id, ...d.data() })) as Aula[]));

    // Cargar dispositivos con get() (OPTIMIZADO: mantener igual)
    const cargarDispositivos = async () => {
      try {
        const dispositivosRef = ref(rtdb, 'dispositivos');
        const snapshot = await get(dispositivosRef);
        const data = snapshot.val();
        
        if (data) {
          const docs = Object.entries(data)
            .map(([id, value]: [string, any]) => ({ id, ...value }))
            .filter(dev => dev.InstitutoId === institutionId);
          setDispositivos(docs);
        }
      } catch (error) {
        console.error("Error cargando dispositivos:", error);
      }
    };
    
    cargarDispositivos();

    return () => { 
      unsubscribeAuth();
      unsubProf(); 
      unsubAulas(); 
    };
  }, [institutionId]);

  // 3. Combinar datos de dispositivos con estado en tiempo real (OPTIMIZADO: usar cache)
  const dispositivosConEstado = useMemo(() => {
    return dispositivos.map(device => {
      const rtStatus = realtimeStatusMap[device.id] || {};
      const lastSeen = rtStatus.lastSeen;
      const online = lastSeen ? (Date.now() - lastSeen) < 45000 : false;
      
      return {
        ...device,
        realtimeStatus: rtStatus,
        online,
        url_actual: rtStatus.url_actual || device.ultimaUrl || 'Sin actividad'
      };
    });
  }, [dispositivos, realtimeStatusMap]);

  // 4. Filtrar alumnos del aula seleccionada (OPTIMIZADO: usar useMemo)
  const alumnosAula = useMemo(() => {
    if (!aulaSeleccionada) return [];
    
    return dispositivosConEstado.filter(d => {
      const coincideAula = String(d.aulaId || "").trim().toUpperCase() === String(aulaSeleccionada.aulaId || "").trim().toUpperCase();
      const coincideSeccion = String(d.seccion || "").trim().toUpperCase() === String(aulaSeleccionada.seccion || "").trim().toUpperCase();
      const esAlumno = d.rol === 'alumno' || (!d.rol && d.alumno_asignado);
      return coincideAula && coincideSeccion && esAlumno;
    });
  }, [dispositivosConEstado, aulaSeleccionada]);

  // FUNCIONES ORIGINALES - COMPLETAMENTE INTACTAS
  const getCurrentUrl = (deviceId: string, fallbackUrl?: string) => {
    const rtInfo = realtimeStatusMap[deviceId];
    return rtInfo?.url_actual || fallbackUrl || 'Sin actividad';
  };

  const checkIsOnline = (deviceId: string) => {
    const rtInfo = realtimeStatusMap[deviceId];
    if (rtInfo?.lastSeen) {
      return (Date.now() - rtInfo.lastSeen) < 45000;
    }
    return false;
  };

  const handleSendMessage = async () => {
    if (!messageModal.tabletId || !messageModal.text.trim()) return;
    try {
      await set(ref(rtdb, `mensajes_dispositivos/${messageModal.tabletId}/ultimo_mensaje`), {
        texto: messageModal.text,
        remitente: "Dirección Institucional",
        timestamp: Date.now(),
        leido: false,
        id: "msg_" + Date.now(),
        titulo: "Mensaje de Dirección"
      });
      setMessageModal({ ...messageModal, isOpen: false, text: '' });
      toast.success('Mensaje enviado correctamente');
    } catch (e) { 
      console.error(e);
      toast.error('Error al enviar mensaje');
    }
  };

  // Renderizado Condicional de carga (INTACTO)
  if (loadingPermissions) {
    return <div className="p-20 text-center text-slate-500 font-black animate-pulse">CARGANDO PERFIL...</div>;
  }

  if (!institutionId) {
    return <div className="p-20 text-center text-red-500 font-black animate-pulse">ERROR: No se pudo identificar la sede</div>;
  }

  // RENDER (COMPLETAMENTE INTACTO - SIN CAMBIOS)
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
        <button 
          onClick={handleLogout}
          className="bg-red-600/80 hover:bg-red-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic flex items-center gap-2 border border-red-500/30 shadow-xl transition-all"
        >
          <LogOut size={14} /> Cerrar Sesión
        </button>
      </header>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3">
              <Lock className="text-orange-500 w-5 h-5" /> Master Switch
            </h2>
            <div className="scale-95 origin-left">
              <GlobalControls institutionId={institutionId} />
            </div>
          </div>
          
          <div className="bg-[#0f1117] border border-slate-800 p-6 rounded-[2rem] flex items-center gap-5">
            <div className="bg-green-500/10 p-4 rounded-2xl text-green-500">
              <Tablet size={28} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase italic">Dispositivos en Red</p>
              <p className="text-3xl font-black text-white italic">{dispositivosConEstado.length}</p>
              <p className="text-[8px] text-green-500 mt-1">Online: {dispositivosConEstado.filter(d => d.online).length}</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <MonitorDocente />
        </div>
      </div>

      {/* CONSULTAS DE INFRACCIONES */}
      <ConsultasInfracciones 
        institutoId={institutionId}
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
                const online = checkIsOnline(alumno.id);
                const currentUrl = getCurrentUrl(alumno.id, alumno.ultimaUrl);
                return (
                  <div key={alumno.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-bold text-xs uppercase truncate pr-2">{alumno.alumno_asignado || 'Sin nombre'}</span>
                      <span className="text-[9px] text-slate-600 font-black">...{alumno.id.slice(-4).toUpperCase()}</span>
                    </div>
                    <div className="bg-black/40 p-3 rounded-xl border border-slate-800/50 flex items-center justify-between">
                      <p className="text-[10px] text-blue-400 font-medium truncate flex-1">{currentUrl}</p>
                      <span className={`ml-2 w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-full py-20 text-center text-slate-500 font-black uppercase italic text-xs">
                  No se detectan alumnos configurados en el aula {aulaSeleccionada.aulaId} - Sección {aulaSeleccionada.seccion}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE MENSAJE PARA ALUMNOS */}
      {messageModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#0f1117] border border-slate-800 w-full max-w-md rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-white font-black uppercase italic">Enviar Mensaje a {messageModal.alumnoNombre}</h3>
              <button onClick={() => setMessageModal({ ...messageModal, isOpen: false })} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6">
              <textarea
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm"
                rows={4}
                placeholder="Escribe el mensaje..."
                value={messageModal.text}
                onChange={(e) => setMessageModal({ ...messageModal, text: e.target.value })}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setMessageModal({ ...messageModal, isOpen: false })} className="flex-1 py-3 bg-slate-800 rounded-xl text-white text-xs font-black uppercase">Cancelar</button>
                <button onClick={handleSendMessage} className="flex-1 py-3 bg-orange-500 rounded-xl text-white text-xs font-black uppercase">Enviar</button>
              </div>
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