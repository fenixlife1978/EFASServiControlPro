'use client';
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/firebase/config';
import { 
  collection, query, onSnapshot, where, addDoc, serverTimestamp, 
  doc, getDoc, updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { 
  ShieldAlert, Radio, Users, LogOut, Lock, Search, MessageSquare, Send,
  Plus, DoorOpen, Activity, Monitor, Globe, ChevronRight, Tablet, User, 
  ArrowLeft, Settings, Trash2, Zap, Save, Building2, Key, Info, Edit3, Link2, Check, X, HardDrive, Smartphone, MapPin, ShieldCheck,
  Unlock 
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { SecurityRules } from '@/components/admin/config/SecurityRules';

// --- CONEXIÓN CON EL PLUGIN NATIVO ---
import { registerPlugin } from '@capacitor/core';
interface LiberarPlugin {
  ejecutarLiberacion(): Promise<{ status: string }>;
}
const LiberarBtn = registerPlugin<LiberarPlugin>('LiberarPlugin');
// -------------------------------------

export default function InstitutionView() {
  const { institutionId, setInstitutionId } = useInstitution();
  const [institutionName, setInstitutionName] = useState('Cargando...');
  
  const [instData, setInstData] = useState<any>({ 
    direccion: '', 
    telefono: '' 
  });

  const [activeSection, setActiveSection] = useState<'dashboard' | 'monitoring' | 'users' | 'settings' | 'security'>('dashboard');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  const [messageModal, setMessageModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '', text: '' });
  const [aulas, setAulas] = useState<any[]>([]);
  const [tablets, setTablets] = useState<any[]>([]);
  const [selectedAula, setSelectedAula] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [allAlumnos, setAllAlumnos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [newAula, setNewAula] = useState<any>({ 
    aulaId: '', 
    seccion: '',
    status: 'active'
  });

  const [editingAula, setEditingAula] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [activeUrlRequest, setActiveUrlRequest] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const inputStyle = "w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase outline-none focus:border-orange-500 transition-all";

  // --- FUNCIÓN DE LIBERACIÓN ---
  const handleLiberarDispositivo = async () => {
    const pass = prompt("SISTEMA CRÍTICO: Ingrese Clave Maestra para ELIMINAR MODO OWNER:");
    
    // Verificación de seguridad
    if (pass === "EDU-ADMIN-2026") { 
      const confirmar = confirm("¡ATENCIÓN! Esto quitará todas las protecciones del dispositivo y cerrará la app para permitir su desinstalación. ¿Proceder?");
      
      if (confirmar) {
        try {
          await LiberarBtn.ejecutarLiberacion();
        } catch (e) {
          alert("Error: El plugin nativo no está disponible en este entorno.");
        }
      }
    } else if (pass !== null) {
      alert("❌ CLAVE INCORRECTA. ACCESO DENEGADO.");
    }
  };

  useEffect(() => {
    if (!institutionId) return;
    const fetchInstData = async () => {
      const docRef = doc(db, "institutions", institutionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setInstitutionName(data.nombre);
        setInstData({ 
          direccion: data.direccion || '', 
          telefono: data.telefono || '' 
        });
      }
    };
    fetchInstData();
  }, [institutionId]);

  useEffect(() => {
    if (!institutionId) return;
    const unsubAulas = onSnapshot(query(collection(db, `institutions/${institutionId}/Aulas`)), (s) => {
      setAulas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTablets = onSnapshot(query(collection(db, "dispositivos"), where("InstitutoId", "==", institutionId)), (s) => {
      setTablets(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubAllAlumnos = onSnapshot(query(collection(db, "usuarios"), where("InstitutoId", "==", institutionId), where("rol", "==", "alumno")), (s) => {
      setAllAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubAulas(); unsubTablets(); unsubAllAlumnos(); };
  }, [institutionId]);

  const handleUpdateInstitution = async () => {
    if (!institutionId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "institutions", institutionId), {
        nombre: institutionName,
        direccion: instData.direccion,
        telefono: instData.telefono,
        lastUpdated: serverTimestamp()
      });
      alert("✅ Datos de la Sede actualizados.");
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleSaveAula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.aulaId || !newAula.seccion || !institutionId) return;
    setIsSaving(true);
    try {
      const customAulaId = newAula.aulaId.toUpperCase().trim().replace(/\s+/g, '_');
      
      // Si estamos editando y el ID cambió, eliminamos el anterior
      if (editingAula && editingAula.id !== customAulaId) {
        await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, editingAula.id));
      }

      const aulaRef = doc(db, "institutions", institutionId, "Aulas", customAulaId);
      await setDoc(aulaRef, {
        aulaId: customAulaId,
        seccion: newAula.seccion.toUpperCase().trim(),
        InstitutoId: institutionId,
        status: 'active',
        createdAt: editingAula?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setNewAula({ aulaId: '', seccion: '', status: 'active' });
      setEditingAula(null);
      setShowModal(false);
      alert("✅ Aula guardada exitosamente.");
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleSendMessage = async () => {
    if (!messageModal.tabletId || !messageModal.text.trim()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "dispositivos", messageModal.tabletId), {
        pending_message: messageModal.text,
        message_timestamp: serverTimestamp()
      });
      setMessageModal({ ...messageModal, isOpen: false, text: '' });
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleDeleteAula = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('¿ELIMINAR ESTA AULA PERMANENTEMENTE?')) return;
    try { 
      await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, id)); 
      alert("✅ Aula eliminada.");
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (userId: string, tabletId?: string) => {
    if (!confirm("¿ELIMINAR ESTE ALUMNO?")) return;
    try {
      if (tabletId) {
        await updateDoc(doc(db, "dispositivos", tabletId), { alumno_asignado: "", status: "available" });
      }
      await deleteDoc(doc(db, "usuarios", userId));
    } catch (e) { console.error(e); }
  };

  const filteredUsers = allAlumnos.filter(a => 
    a.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans">
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
              EDUControlPro Enterprise Shield v3.0
            </div>
            <h1 className="text-2xl font-black italic uppercase text-white tracking-tighter">
              {institutionName} <span className="text-slate-500 font-light ml-2">/ {activeSection.toUpperCase()}</span>
            </h1>
          </div>
          <button onClick={() => setInstitutionId(null)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase italic">← Volver a Sedes</button>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
          
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3"><Lock className="text-orange-500 w-5 h-5" /> Master Switch</h2>
              <div className="scale-95 origin-left"><GlobalControls institutionId={institutionId!} /></div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <div className="bg-[#0f1117] p-10 rounded-[3rem] border border-slate-800 min-h-[600px] relative">
              
              {/* VISTA DASHBOARD */}
              {activeSection === 'dashboard' && !selectedAula && (
                <>
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Mapa <span className="text-orange-500 font-light">de Aulas</span></h2>
                    <button onClick={() => { setEditingAula(null); setNewAula({ aulaId: '', seccion: '', status: 'active' }); setShowModal(true); }} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95">
                      <Plus className="w-4 h-4" /> Nueva Aula
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aulas.map((aula) => (
                      <div key={aula.id} className="bg-slate-900/30 p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500 transition-all group relative">
                        {/* BOTONES DE ACCIÓN (MARCADOS EN ROJO EN TU IMAGEN) */}
                        <div className="absolute top-6 right-6 flex gap-2 z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAula(aula);
                              setNewAula({ aulaId: aula.aulaId, seccion: aula.seccion, status: aula.status });
                              setShowModal(true);
                            }}
                            className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 transition-all shadow-lg"
                            title="Editar Aula"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteAula(e, aula.id)}
                            className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all shadow-lg"
                            title="Eliminar Aula"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div 
                          onClick={() => setSelectedAula(aula)}
                          className="cursor-pointer"
                        >
                          <DoorOpen className="w-10 h-10 text-slate-700 mb-4 group-hover:text-orange-500 transition-colors" />
                          <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">{aula.aulaId}</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">SECCIÓN {aula.seccion || 'A'}</p>
                        </div>
                      </div>
                    ))}
                    
                    {aulas.length === 0 && (
                      <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-[3rem]">
                        <DoorOpen className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-slate-600 uppercase italic">No hay aulas configuradas en esta sede</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* SECCIÓN DE USUARIOS */}
              {activeSection === 'users' && (
                <div className="space-y-8">
                   <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Directorio <span className="text-orange-500 font-light">Alumnos</span></h2>
                   {/* Tabla simplificada por espacio... */}
                </div>
              )}

              {/* SECCIÓN SETTINGS */}
              {activeSection === 'settings' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Ajustes <span className="text-orange-500 font-light">de Sede</span></h2>
                    <button onClick={handleUpdateInstitution} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic transition-all flex items-center gap-2">
                      <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Datos'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Formulario de Datos */}
                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
                      <div className="flex items-center gap-3 text-orange-500 mb-2"><Building2 size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Información Pública</span></div>
                      <input className={inputStyle} value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Nombre sede" />
                      <input className={inputStyle} value={instData.direccion} onChange={(e) => setInstData({...instData, direccion: e.target.value})} placeholder="Dirección" />
                      <input className={inputStyle} value={instData.telefono} onChange={(e) => setInstData({...instData, telefono: e.target.value})} placeholder="Teléfono" />
                    </div>

                    {/* ZONA DE PELIGRO / HARDWARE */}
                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 text-red-500 mb-4"><Key size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Seguridad de Hardware</span></div>
                        <div className="w-full bg-black/50 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-500 mb-6">
                          DEVICE_ROOT_ID: {institutionId}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium uppercase">
                          El botón inferior desactiva el bloqueo de desinstalación de Android y renuncia a los privilegios de administrador del sistema.
                        </p>
                      </div>

                      <div className="mt-8">
                        <button 
                          onClick={handleLiberarDispositivo}
                          className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl text-[11px] font-black uppercase italic transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-900/20"
                        >
                          <Unlock size={18} /> 
                          Liberar Tablet (Modo Owner)
                        </button>
                        <p className="text-[9px] text-red-500/60 mt-3 text-center font-bold uppercase">
                          ⚠️ Acción irreversible para el hardware actual
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeSection === 'security' && <SecurityRules institutionId={institutionId!} />}

            </div>
          </div>
        </div>
      </main>

      {/* MODAL DE GESTIÓN DE AULA (AHORA FUNCIONAL) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-transparent"></div>
              
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
                  {editingAula ? 'Editar' : 'Nueva'} <span className="text-orange-500">Aula</span>
                </h2>
                <button onClick={() => { setShowModal(false); setEditingAula(null); }} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSaveAula} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-2 italic tracking-widest">Identificador del Aula</label>
                  <input 
                    required
                    className={inputStyle}
                    placeholder="EJ: 5TO GRADO"
                    value={newAula.aulaId}
                    onChange={e => setNewAula({...newAula, aulaId: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-2 italic tracking-widest">Sección / Letra</label>
                  <input 
                    required
                    className={inputStyle}
                    placeholder="EJ: A"
                    value={newAula.seccion}
                    onChange={e => setNewAula({...newAula, seccion: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => { setShowModal(false); setEditingAula(null); }}
                    className="flex-1 bg-slate-900 text-slate-500 font-black py-5 rounded-2xl text-[10px] uppercase italic transition-all hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-2 bg-orange-500 hover:bg-orange-600 text-white font-black py-5 px-8 rounded-2xl text-[10px] uppercase italic transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                  >
                    {isSaving ? 'Sincronizando...' : (editingAula ? 'Actualizar Cambios' : 'Registrar Aula')}
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {messageModal.isOpen && (
        <div className="fixed inset-0 bg-[#0a0c10]/95 z-[120] flex items-center justify-center p-4">
           {/* Contenido modal mensaje... */}
        </div>
      )}

      <WebHistoryModal isOpen={historyModal.isOpen} onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} tabletId={historyModal.tabletId} alumnoNombre={historyModal.alumnoNombre} />
    </div>
  );
}
