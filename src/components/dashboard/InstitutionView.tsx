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
  Unlock, RefreshCcw
} from 'lucide-react';
import { signOut } from 'firebase/auth';
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
  const [messageModal, setMessageModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '', text: '' });
  const [aulas, setAulas] = useState<any[]>([]);
  const [tablets, setTablets] = useState<any[]>([]);
  const [selectedAula, setSelectedAula] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [allAlumnos, setAllAlumnos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newAula, setNewAula] = useState<any>({ aulaId: '', seccion: '', status: 'active' });
  const [editingAula, setEditingAula] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const inputStyle = "w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase outline-none focus:border-orange-500 transition-all";

  // --- ACCIÓN: REBLOQUEAR (CERRAR SESIÓN ADMIN) ---
  const handleRebloquear = async () => {
    try {
      await LiberarBtn.ejecutarRebloqueo();
      alert("✅ SEGURIDAD RESTAURADA: Los ajustes han sido bloqueados para el alumno.");
    } catch (e) {
      alert("Error: El plugin no respondió. Asegúrese de estar en la Tablet.");
    }
  };

  // --- ACCIÓN: CAMBIAR PIN (SINCRO FIREBASE GLOBAL) ---
  // CORRECCIÓN: Ahora apunta a la ruta universal /system_config/security
  const handleChangePin = async () => {
    const newPin = prompt("Ingrese el NUEVO PIN maestro UNIVERSAL (4 dígitos):");
    
    if (newPin && /^\d{4}$/.test(newPin)) {
      setIsSaving(true);
      try {
        const globalSecurityRef = doc(db, "system_config", "security");
        await setDoc(globalSecurityRef, { 
          master_pin: newPin,
          last_change: serverTimestamp(),
          updated_by: "SuperAdmin"
        }, { merge: true });
        
        alert(`✅ PIN MAESTRO GLOBAL ACTUALIZADO: ${newPin}.\nTodas las tablets de todas las sedes se sincronizarán automáticamente.`);
      } catch (e) {
        console.error(e);
        alert("Error al guardar el PIN global en la nube.");
      }
      setIsSaving(false);
    } else if (newPin !== null) {
      alert("❌ Error: El PIN debe ser de exactamente 4 números.");
    }
  };

  // --- FUNCIÓN DE LIBERACIÓN TOTAL ---
  const handleLiberarDispositivo = async () => {
    const pass = prompt("SISTEMA CRÍTICO: Ingrese Clave Maestra para ELIMINAR MODO OWNER:");
    if (pass === "EDU-ADMIN-2026") { 
      const confirmar = confirm("¡ATENCIÓN! Esto quitará todas las protecciones del dispositivo. ¿Proceder?");
      if (confirmar) {
        try { await LiberarBtn.ejecutarLiberacion(); } catch (e) { alert("Error de Plugin."); }
      }
    } else if (pass !== null) { alert("❌ CLAVE INCORRECTA."); }
  };

  useEffect(() => {
    if (!institutionId) return;
    const fetchInstData = async () => {
      const docRef = doc(db, "institutions", institutionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setInstitutionName(data.nombre);
        setInstData({ direccion: data.direccion || '', telefono: data.telefono || '' });
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
      alert("✅ Datos de sede actualizados.");
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleSaveAula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.aulaId || !newAula.seccion || !institutionId) return;
    setIsSaving(true);
    try {
      const customAulaId = newAula.aulaId.toUpperCase().trim().replace(/\s+/g, '_');
      if (editingAula && editingAula.id !== customAulaId) {
        await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, editingAula.id));
      }
      const aulaRef = doc(db, "institutions", institutionId, "Aulas", customAulaId);
      await setDoc(aulaRef, {
        aulaId: customAulaId, seccion: newAula.seccion.toUpperCase().trim(),
        InstitutoId: institutionId, status: 'active',
        createdAt: editingAula?.createdAt || serverTimestamp(), updatedAt: serverTimestamp()
      });
      setNewAula({ aulaId: '', seccion: '', status: 'active' });
      setEditingAula(null); setShowModal(false);
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleDeleteAula = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('¿ELIMINAR ESTA AULA PERMANENTEMENTE?')) return;
    try { await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, id)); } catch (e) { console.error(e); }
  };

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

            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3"><Zap className="text-yellow-500 w-5 h-5" /> Terminal Nativa</h2>
              <div className="space-y-4">
                <button 
                  onClick={handleRebloquear}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase italic transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={16} /> Re-Activar Bloqueo Alumno
                </button>
                <p className="text-[9px] text-slate-500 text-center uppercase font-bold">Protección inmediata tras soporte técnico</p>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <div className="bg-[#0f1117] p-10 rounded-[3rem] border border-slate-800 min-h-[600px] relative">
              
              {activeSection === 'dashboard' && !selectedAula && (
                <>
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Mapa <span className="text-orange-500 font-light">de Aulas</span></h2>
                    <button onClick={() => { setEditingAula(null); setNewAula({ aulaId: '', seccion: '', status: 'active' }); setShowModal(true); }} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic flex items-center gap-2 shadow-lg shadow-orange-500/20">
                      <Plus className="w-4 h-4" /> Nueva Aula
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aulas.map((aula) => (
                      <div key={aula.id} className="bg-slate-900/30 p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500 transition-all group relative">
                        <div className="absolute top-6 right-6 flex gap-2 z-10">
                          <button onClick={(e) => { e.stopPropagation(); setEditingAula(aula); setNewAula({ aulaId: aula.aulaId, seccion: aula.seccion, status: aula.status }); setShowModal(true); }} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 transition-all"><Edit3 size={16} /></button>
                          <button onClick={(e) => handleDeleteAula(e, aula.id)} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={16} /></button>
                        </div>
                        <div onClick={() => setSelectedAula(aula)} className="cursor-pointer">
                          <DoorOpen className="w-10 h-10 text-slate-700 mb-4 group-hover:text-orange-500 transition-colors" />
                          <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">{aula.aulaId}</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">SECCIÓN {aula.seccion || 'A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeSection === 'settings' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Ajustes <span className="text-orange-500 font-light">de Sede</span></h2>
                    <button onClick={handleUpdateInstitution} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic transition-all flex items-center gap-2">
                      <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Datos'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
                      <div className="flex items-center gap-3 text-orange-500 mb-2"><Building2 size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Información Pública</span></div>
                      <input className={inputStyle} value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Nombre sede" />
                      <input className={inputStyle} value={instData.direccion} onChange={(e) => setInstData({...instData, direccion: e.target.value})} placeholder="Dirección" />
                      <input className={inputStyle} value={instData.telefono} onChange={(e) => setInstData({...instData, telefono: e.target.value})} placeholder="Teléfono" />
                    </div>

                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
                      <div className="flex items-center gap-3 text-red-500 mb-2"><Key size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Seguridad Universal</span></div>
                      
                      <button 
                        onClick={handleChangePin}
                        className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white p-4 rounded-xl text-[10px] font-black uppercase italic border border-red-500/20 flex justify-between items-center group transition-all"
                      >
                        Cambiar PIN Maestro Global
                        <ShieldCheck size={14} />
                      </button>

                      <hr className="border-slate-800" />

                      <button onClick={handleLiberarDispositivo} className="w-full bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white py-5 rounded-2xl text-[11px] font-black uppercase italic transition-all border border-slate-700 flex items-center justify-center gap-3">
                        <Unlock size={18} /> Liberar Tablet (Root)
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {activeSection === 'security' && <SecurityRules institutionId={institutionId!} />}
              {activeSection === 'users' && <div className="text-center py-20 uppercase font-black italic text-slate-700">Módulo de Alumnos Activo</div>}

            </div>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md relative">
              <h2 className="text-2xl font-black italic uppercase text-white mb-8">Gestión <span className="text-orange-500">Aula</span></h2>
              <form onSubmit={handleSaveAula} className="space-y-6">
                <input required className={inputStyle} placeholder="EJ: 5TO GRADO" value={newAula.aulaId} onChange={e => setNewAula({...newAula, aulaId: e.target.value})} />
                <input required className={inputStyle} placeholder="EJ: A" value={newAula.seccion} onChange={e => setNewAula({...newAula, seccion: e.target.value})} />
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-900 text-slate-500 font-black py-5 rounded-2xl text-[10px] uppercase">Cancelar</button>
                  <button type="submit" className="flex-2 bg-orange-500 text-white font-black py-5 px-8 rounded-2xl text-[10px] uppercase">Guardar</button>
                </div>
              </form>
            </div>
        </div>
      )}
    </div>
  );
}
