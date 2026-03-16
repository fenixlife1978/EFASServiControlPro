'use client';
import React, { useState, useEffect } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { ref, onValue, update, remove } from 'firebase/database'; // Añadidos update y remove
import { 
  collection, query, onSnapshot, where, addDoc, serverTimestamp, 
  doc, getDoc, updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { 
  ShieldAlert, Activity, Users, LogOut, Lock, Search, MessageSquare, 
  Plus, DoorOpen, Globe, ArrowLeft, Settings, Trash2, Zap, Smartphone, 
  User, Unlock, RefreshCcw, ShieldCheck, Edit3
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner'; // Importación de Sonner
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { SecurityRules } from '@/components/admin/config/SecurityRules';

// --- CONEXIÓN CON EL PLUGIN NATIVO ---
import { registerPlugin } from '@capacitor/core';
interface LiberarPlugin {
  ejecutarLiberacion(): Promise<{ status: string }>;
  ejecutarRebloqueo(): Promise<{ status: string }>;
}
const LiberarBtn = registerPlugin<LiberarPlugin>('LiberarPlugin');

export default function InstitutionView() {
  const { institutionId, setInstitutionId } = useInstitution();
  const [institutionName, setInstitutionName] = useState('Cargando...');
  const [instData, setInstData] = useState<any>({ direccion: '', telefono: '' });
  const [activeSection, setActiveSection] = useState<'dashboard' | 'monitoring' | 'users' | 'settings' | 'security'>('dashboard');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  const [aulas, setAulas] = useState<any[]>([]);
  const [tablets, setTablets] = useState<any[]>([]);
  const [selectedAula, setSelectedAula] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newAula, setNewAula] = useState<any>({ aulaId: '', seccion: '', status: 'active' });
  const [isSaving, setIsSaving] = useState(false);
  const [realtimeStats, setRealtimeStats] = useState<any>({});

  const inputStyle = "w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase outline-none focus:border-orange-500 transition-all";

  // --- NUEVAS FUNCIONES DE GESTIÓN DE DISPOSITIVOS ---
  
  const handleUpdateDeviceName = async (deviceId: string, currentName: string) => {
    const newName = prompt("INGRESE EL NOMBRE DEL NUEVO ALUMNO ASIGNADO:", currentName);
    if (!newName || newName === currentName) return;

    const toastId = toast.loading("Actualizando asignación...");
    try {
      // 1. Actualizar en Firestore
      await updateDoc(doc(db, "dispositivos", deviceId), {
        alumno_asignado: newName.toUpperCase(),
        lastUpdated: serverTimestamp()
      });

      // 2. Sincronizar con RTDB para cambios en vivo
      const deviceRef = ref(rtdb, `dispositivos/${deviceId}`);
      await update(deviceRef, { nombre: newName.toUpperCase() });

      toast.success("Dispositivo reasignado correctamente", { id: toastId });
    } catch (error) {
      toast.error("Error al reasignar", { id: toastId });
      console.error(error);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm(`¿ESTÁ SEGURO DE ELIMINAR EL DISPOSITIVO ${deviceId}? ESTA ACCIÓN NO SE PUEDE DESHACER.`)) return;

    const toastId = toast.loading("Eliminando registro del sistema...");
    try {
      // Eliminar de Firestore
      await deleteDoc(doc(db, "dispositivos", deviceId));
      
      // Eliminar de RTDB
      const deviceRef = ref(rtdb, `dispositivos/${deviceId}`);
      await remove(deviceRef);

      toast.success("Dispositivo eliminado con éxito", { id: toastId });
    } catch (error) {
      toast.error("No se pudo eliminar el dispositivo", { id: toastId });
    }
  };

  // --- LÓGICA DE ESTADO ONLINE ---
  const checkIsOnline = (deviceId: string, firestoreUltimoAcceso: any) => {
    const rtData = realtimeStats[deviceId];
    if (rtData && rtData.lastActive) {
      const diff = Date.now() - rtData.lastActive;
      return diff < 30000 ? "online" : "offline";
    }
    if (!firestoreUltimoAcceso) return "no_data"; 
    const lastSeenDate = firestoreUltimoAcceso.toDate ? firestoreUltimoAcceso.toDate() : new Date(firestoreUltimoAcceso);
    const now = new Date();
    const diff = now.getTime() - lastSeenDate.getTime();
    return diff < 60000 ? "online" : "offline";
  };

  // --- LISTENERS FIREBASE ---
  useEffect(() => {
    if (!institutionId) return;
    
    getDoc(doc(db, "institutions", institutionId)).then(snap => {
      if (snap.exists()) {
        setInstitutionName(snap.data().nombre);
        setInstData({ direccion: snap.data().direccion || '', telefono: snap.data().telefono || '' });
      }
    });

    const unsubAulas = onSnapshot(query(collection(db, `institutions/${institutionId}/Aulas`)), (s) => {
      setAulas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubTablets = onSnapshot(query(collection(db, "dispositivos"), where("InstitutoId", "==", institutionId)), (s) => {
      setTablets(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const rtRef = ref(rtdb, `monitoring/${institutionId}`);
    const unsubRTDB = onValue(rtRef, (snapshot) => {
      if (snapshot.exists()) setRealtimeStats(snapshot.val());
    });

    return () => { unsubAulas(); unsubTablets(); unsubRTDB(); };
  }, [institutionId]);

  useEffect(() => {
    if (selectedAula && institutionId) {
      const filtrados = tablets.filter(dev => 
        dev.InstitutoId === institutionId && 
        dev.aulaId === selectedAula.aulaId && 
        dev.seccion === selectedAula.seccion
      );
      setAlumnos(filtrados);
    } else {
      setAlumnos([]);
    }
  }, [selectedAula, tablets, institutionId]);

  // --- ACCIONES NATIVAS ---
  const handleRebloquear = async () => {
    try {
      await LiberarBtn.ejecutarRebloqueo();
      toast.success("SEGURIDAD RESTAURADA NATIVAMENTE");
    } catch (e) { toast.error("Plugin nativo no detectado"); }
  };

  const handleChangePin = async () => {
    const newPin = prompt("NUEVO PIN (4 dígitos):");
    if (newPin && /^\d{4}$/.test(newPin)) {
      setIsSaving(true);
      try {
        await setDoc(doc(db, "system_config", "security"), { 
          master_pin: newPin,
          last_change: serverTimestamp()
        }, { merge: true });
        toast.success(`PIN GLOBAL ACTUALIZADO: ${newPin}`);
      } catch (e) { toast.error("Error al guardar en Firebase"); }
      setIsSaving(false);
    }
  };

  const handleLiberarDispositivo = async () => {
    const pass = prompt("CLAVE MAESTRA:");
    if (pass === "EDU-ADMIN-2026") { 
      try { await LiberarBtn.ejecutarLiberacion(); toast.warning("DISPOSITIVO LIBERADO"); } catch (e) { toast.error("Error Plugin"); }
    }
  };

  const handleUpdateInstitution = async () => {
    if (!institutionId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "institutions", institutionId), {
        nombre: institutionName,
        direccion: instData.direccion,
        telefono: instData.telefono
      });
      toast.success("Información de sede actualizada");
    } catch (e) { toast.error("Error al actualizar"); }
    setIsSaving(false);
  };

  const handleSaveAula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.aulaId || !newAula.seccion || !institutionId) return;
    setIsSaving(true);
    try {
      const customAulaId = newAula.aulaId.toUpperCase().trim().replace(/\s+/g, '_');
      const aulaRef = doc(db, "institutions", institutionId, "Aulas", customAulaId);
      await setDoc(aulaRef, {
        aulaId: customAulaId, seccion: newAula.seccion.toUpperCase().trim(),
        InstitutoId: institutionId, status: 'active', updatedAt: serverTimestamp()
      });
      setShowModal(false);
      toast.success("Aula creada exitosamente");
    } catch (e) { toast.error("Error al crear aula"); }
    setIsSaving(false);
  };

  const handleDeleteAula = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('¿ELIMINAR AULA COMPLETAMENTE?')) {
      try {
        await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, id));
        toast.error("Aula eliminada");
      } catch (e) { toast.error("Error al eliminar"); }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans italic-text-fix">
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#0f1117] border-r border-slate-800/50 flex flex-col items-center py-8 gap-8 z-50">
        <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20"><ShieldAlert className="text-white w-6 h-6" /></div>
        <div className="flex-1 flex flex-col gap-6 pt-10">
          <button onClick={() => { setActiveSection('dashboard'); setSelectedAula(null); }} className={`p-3 rounded-xl transition-all ${activeSection === 'dashboard' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Activity className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('security')} className={`p-3 rounded-xl transition-all ${activeSection === 'security' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><ShieldCheck className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('users')} className={`p-3 rounded-xl transition-all ${activeSection === 'users' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Users className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('settings')} className={`p-3 rounded-xl transition-all ${activeSection === 'settings' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Settings className="w-5 h-5" /></button>
        </div>
        <button onClick={() => signOut(auth)} className="p-3 text-slate-600 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
      </nav>

      <main className="pl-20">
        <header className="sticky top-0 z-40 bg-[#0a0c10]/80 backdrop-blur-md border-b border-slate-800/50 px-8 py-6 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.4em] text-orange-500 mb-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
              EFAS ServiControlPro v3.0
            </div>
            <h1 className="text-2xl font-black italic uppercase text-white tracking-tighter">
              {institutionName} <span className="text-slate-500 font-light ml-2">/ {activeSection.toUpperCase()}</span>
            </h1>
          </div>
          <button onClick={() => setInstitutionId(null)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase italic">← Volver a Sedes</button>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
          {/* BARRA LATERAL IZQUIERDA */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3"><Lock className="text-orange-500 w-5 h-5" /> Master Switch</h2>
              <div className="scale-95 origin-left"><GlobalControls institutionId={institutionId!} /></div>
            </div>
            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3"><Zap className="text-yellow-500 w-5 h-5" /> Terminal Nativa</h2>
              <button onClick={handleRebloquear} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase italic transition-all flex items-center justify-center gap-2">
                <RefreshCcw size={16} /> Re-Activar Bloqueo Alumno
              </button>
            </div>
          </div>

          {/* CONTENIDO PRINCIPAL */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-[#0f1117] p-10 rounded-[3rem] border border-slate-800 min-h-[600px] relative">
              
              {/* VISTA: MAPA DE AULAS */}
              {activeSection === 'dashboard' && !selectedAula && (
                <>
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Mapa <span className="text-orange-500 font-light">de Aulas</span></h2>
                    <button onClick={() => setShowModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic flex items-center gap-2 shadow-lg shadow-orange-500/20">
                      <Plus className="w-4 h-4" /> Nueva Aula
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aulas.map((aula) => (
                      <div key={aula.id} onClick={() => setSelectedAula(aula)} className="bg-slate-900/30 p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500 transition-all group relative cursor-pointer">
                        <div className="absolute top-6 right-6 flex gap-2 z-10">
                          <button onClick={(e) => handleDeleteAula(e, aula.id)} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                        </div>
                        <DoorOpen className="w-10 h-10 text-slate-700 mb-4 group-hover:text-orange-500 transition-colors" />
                        <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">{aula.aulaId}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">SECCIÓN {aula.seccion}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* VISTA: LISTA DE DISPOSITIVOS POR AULA */}
              {activeSection === 'dashboard' && selectedAula && (
                <div className="animate-in fade-in slide-in-from-right duration-300">
                  <div className="flex justify-between items-center mb-10">
                    <button onClick={() => setSelectedAula(null)} className="text-slate-500 hover:text-white flex items-center gap-2 uppercase font-black text-[10px]">
                      <ArrowLeft size={16} /> Volver al Mapa
                    </button>
                    <div className="text-right">
                      <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">
                        {selectedAula.aulaId} <span className="text-orange-500 font-light">Secc. {selectedAula.seccion}</span>
                      </h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{alumnos.length} Dispositivos Vinculados</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {alumnos.length === 0 ? (
                      <div className="py-20 text-center border border-dashed border-slate-800 rounded-[2rem] text-slate-700 font-black uppercase italic">
                        No hay dispositivos vinculados en esta aula
                      </div>
                    ) : (
                      alumnos.map((alumno) => {
                        const status = checkIsOnline(alumno.id, alumno.ultimoAcceso);
                        return (
                          <div key={alumno.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] flex items-center justify-between group transition-all hover:border-slate-700">
                            <div className="flex items-center gap-5">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${status === 'online' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                <Smartphone size={20} />
                              </div>
                              <div>
                                <h4 className="font-black uppercase text-white italic text-lg leading-none mb-1">
                                  {alumno.alumno_asignado || "DESCONOCIDO"}
                                </h4>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                                    ID: {alumno.id}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded uppercase ${
                                      status === "online" ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                      <span className={`w-1 h-1 rounded-full ${status === "online" ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                      {status === "online" ? 'SISTEMA ACTIVO' : 'DESCONECTADO'}
                                    </span>
                                    {realtimeStats[alumno.id]?.currentUrl && (
                                      <span className="text-[8px] text-blue-400 font-bold truncate max-w-[120px] italic">
                                        🔗 {realtimeStats[alumno.id].currentUrl}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* BOTONES DE ACCIÓN (Aparecen con el Hover) */}
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleUpdateDeviceName(alumno.id, alumno.alumno_asignado)}
                                className="p-3 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl transition-all"
                                title="Reasignar Alumno"
                              >
                                <Edit3 size={16}/>
                              </button>
                              <button 
                                onClick={() => setHistoryModal({ isOpen: true, tabletId: alumno.id, alumnoNombre: alumno.alumno_asignado || alumno.id })} 
                                className="p-3 bg-slate-800 hover:bg-orange-500 text-slate-400 hover:text-white rounded-xl transition-all"
                                title="Ver Historial Web"
                              >
                                <Globe size={16}/>
                              </button>
                              <button 
                                onClick={() => handleDeleteDevice(alumno.id)}
                                className="p-3 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl transition-all"
                                title="Eliminar del Sistema"
                              >
                                <Trash2 size={16}/>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* VISTAS DE CONFIGURACIÓN Y SEGURIDAD */}
              {activeSection === 'settings' && (
                <div className="space-y-10">
                  <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Ajustes <span className="text-orange-500 font-light">de Sede</span></h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
                      <input className={inputStyle} value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Nombre sede" />
                      <input className={inputStyle} value={instData.direccion} onChange={(e) => setInstData({...instData, direccion: e.target.value})} placeholder="Dirección" />
                      <button onClick={handleUpdateInstitution} className="w-full bg-orange-500 text-white font-black py-4 rounded-xl text-[10px] uppercase italic">Guardar Información</button>
                    </div>
                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-4">
                      <button onClick={handleChangePin} className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white p-4 rounded-xl text-[10px] font-black uppercase italic border border-red-500/20 flex justify-between items-center transition-all">Cambiar PIN Maestro <ShieldCheck size={14} /></button>
                      <button onClick={handleLiberarDispositivo} className="w-full bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white py-5 rounded-2xl text-[11px] font-black uppercase italic transition-all flex items-center justify-center gap-3"><Unlock size={18} /> Liberar Tablet</button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'security' && <SecurityRules institutionId={institutionId!} />}
              {activeSection === 'users' && <div className="text-center py-20 uppercase font-black italic text-slate-700">Módulo de Usuarios en Construcción</div>}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: NUEVA AULA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md">
            <h2 className="text-2xl font-black italic uppercase text-white mb-8">Gestión <span className="text-orange-500">Aula</span></h2>
            <form onSubmit={handleSaveAula} className="space-y-6">
              <input required className={inputStyle} placeholder="EJ: 5TO GRADO" value={newAula.aulaId} onChange={e => setNewAula({...newAula, aulaId: e.target.value})} />
              <input required className={inputStyle} placeholder="EJ: A" value={newAula.seccion} onChange={e => setNewAula({...newAula, seccion: e.target.value})} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-900 text-slate-500 font-black py-5 rounded-2xl text-[10px] uppercase">Cancelar</button>
                <button type="submit" className="flex-2 bg-orange-500 text-white font-black py-5 px-8 rounded-2xl text-[10px] uppercase">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL WEB */}
      {historyModal.isOpen && (
        <WebHistoryModal 
          isOpen={historyModal.isOpen} 
          onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} 
          tabletId={historyModal.tabletId} 
          alumnoNombre={historyModal.alumnoNombre} 
        />
      )}
    </div>
  );
}
