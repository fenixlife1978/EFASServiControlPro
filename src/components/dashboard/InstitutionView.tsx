'use client';
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/firebase/config';
import { collection, query, onSnapshot, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { 
  ShieldAlert, Radio, Users, LogOut, Lock, Search, Cpu, Battery, Link, MessageSquare, Send,
  Plus, DoorOpen, Activity, Monitor, Globe, X, ChevronRight, Tablet, User, ArrowLeft, Settings, Edit2, Trash2, Check, Zap, FileText, BarChart3, Clock, Save, Building2, Key, Info, Edit3
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { SecurityRules } from '@/components/admin/config/SecurityRules';

export default function InstitutionView() {
  const { institutionId, setInstitutionId } = useInstitution();
  const [institutionName, setInstitutionName] = useState('Cargando...');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'monitoring' | 'users' | 'settings'>('dashboard');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '' });
  const [messageModal, setMessageModal] = useState({ isOpen: false, tabletId: '', alumnoNombre: '', text: '' });
  const [aulas, setAulas] = useState<any[]>([]);
  const [tablets, setTablets] = useState<any[]>([]);
  const [selectedAula, setSelectedAula] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [allAlumnos, setAllAlumnos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newAula, setNewAula] = useState({ nombre_completo: '', seccion: '' });
  const [editingAula, setEditingAula] = useState<any>(null);
  
  const [reportFilter, setReportFilter] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [editingAlumno, setEditingAlumno] = useState<any>(null);
  const [tempName, setTempName] = useState('');

  const inputStyle = "w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase outline-none focus:border-orange-500 transition-all";

  useEffect(() => {
    if (!institutionId) return;
    const fetchInstName = async () => {
      const docRef = doc(db, "institutions", institutionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setInstitutionName(docSnap.data().nombre);
    };
    fetchInstName();
  }, [institutionId]);

  useEffect(() => {
    if (!institutionId) return;
    const unsubAulas = onSnapshot(query(collection(db, `institutions/${institutionId}/Aulas`)), (s) => {
      setAulas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTablets = onSnapshot(query(collection(db, "dispositivos"), where("InstitutoId", "==", institutionId)), (s) => {
      setTablets(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubAllAlumnos = onSnapshot(query(collection(db, "usuarios"), where("InstitutoId", "==", institutionId), where("role", "==", "estudiante")), (s) => {
      setAllAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubAulas(); unsubTablets(); unsubAllAlumnos(); };
  }, [institutionId]);

  useEffect(() => {
    if (!selectedAula || !institutionId) {
      setAlumnos([]);
      return;
    }
    const q = query(collection(db, "usuarios"), 
              where("InstitutoId", "==", institutionId), 
              where("aulaId", "==", selectedAula.id),
              where("role", "==", "estudiante"));
    return onSnapshot(q, (s) => {
      setAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [selectedAula, institutionId]);

  const handleSendMessage = async () => {
    if (!messageModal.tabletId || !messageModal.text.trim()) return;
    setIsSaving(true);
    try {
      const tabletRef = doc(db, "dispositivos", messageModal.tabletId);
      await updateDoc(tabletRef, {
        pending_message: messageModal.text,
        message_timestamp: serverTimestamp(),
        message_sender: "Dirección Institucional"
      });
      alert(`Mensaje enviado a ${messageModal.alumnoNombre}`);
      setMessageModal({ ...messageModal, isOpen: false, text: '' });
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleUpdateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "institutions", institutionId), {
        nombre: institutionName,
        lastUpdate: serverTimestamp()
      });
      alert("Configuración actualizada.");
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleUpdateName = async () => {
    if (!tempName.trim() || !editingAlumno) return;
    try {
      await updateDoc(doc(db, "usuarios", editingAlumno.id), { nombre: tempName });
      if (editingAlumno.tabletId) {
        await updateDoc(doc(db, "dispositivos", editingAlumno.tabletId), { alumno_asignado: tempName });
      }
      setEditingAlumno(null);
      setTempName('');
    } catch (e) { console.error(e); }
  };

  const handleDeleteStudent = async (alumno: any) => {
    if (!confirm(`¿Eliminar a ${alumno.nombre}?`)) return;
    try {
      if (alumno.tabletId) {
        await updateDoc(doc(db, "dispositivos", alumno.tabletId), {
          alumno_asignado: "",
          aulaId: "",
          InstitutoId: "",
          status: "pending_name"
        });
      }
      await deleteDoc(doc(db, "usuarios", alumno.id));
    } catch (e) { console.error(e); }
  };

  const handleSaveAula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.nombre_completo || !newAula.seccion) return;
    try {
      if (editingAula) {
        await updateDoc(doc(db, `institutions/${institutionId}/Aulas`, editingAula.id), {
          ...newAula,
          lastUpdated: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, `institutions/${institutionId}/Aulas`), {
          ...newAula,
          status: 'published',
          createdAt: serverTimestamp(),
          InstitutoId: institutionId
        });
      }
      setShowModal(false);
      setEditingAula(null);
      setNewAula({ nombre_completo: '', seccion: '' });
    } catch (e) { console.error(e); }
  };

  const handleDeleteAula = async (e: React.MouseEvent, aulaId: string) => {
    e.stopPropagation();
    if (!confirm('¿ELIMINAR ESTA AULA PERMANENTEMENTE?')) return;
    try {
      await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, aulaId));
    } catch (e) { console.error(e); }
  };

  const handleEditAula = (e: React.MouseEvent, aula: any) => {
    e.stopPropagation();
    setEditingAula(aula);
    setNewAula({ nombre_completo: aula.nombre_completo, seccion: aula.seccion });
    setShowModal(true);
  };

  const filteredUsers = allAlumnos.filter(a => 
    a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.tabletId && a.tabletId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans">
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#0f1117] border-r border-slate-800/50 flex flex-col items-center py-8 gap-8 z-50">
        <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20"><ShieldAlert className="text-white w-6 h-6" /></div>
        <div className="flex-1 flex flex-col gap-6 pt-10">
          <button onClick={() => { setActiveSection('dashboard'); setSelectedAula(null); }} className={`p-3 rounded-xl transition-all ${activeSection === 'dashboard' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Activity className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('monitoring')} className={`p-3 rounded-xl transition-all ${activeSection === 'monitoring' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Monitor className="w-5 h-5" /></button>
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
          <button onClick={() => setInstitutionId(null)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase italic flex items-center gap-2">← Volver a Sedes</button>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-black italic uppercase text-white mb-6 flex items-center gap-3"><Lock className="text-orange-500 w-5 h-5" /> Master Switch</h2>
              <div className="scale-95 origin-left"><GlobalControls institutionId={institutionId!} /></div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800">
               <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest italic mb-6">Métricas del Periodo</h3>
               <div className="space-y-4">
                  <div className="bg-black/20 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center">
                      <div>
                        <p className="text-[8px] font-black text-slate-600 uppercase">Sitios Bloqueados</p>
                        <p className="text-xl font-black text-white italic">142</p>
                      </div>
                      <BarChart3 className="text-orange-500/20 w-8 h-8" />
                  </div>
                  <div className="bg-black/20 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center">
                      <div>
                        <p className="text-[8px] font-black text-slate-600 uppercase">Tiempo de Uso Promedio</p>
                        <p className="text-xl font-black text-white italic">4h 20m</p>
                      </div>
                      <Clock className="text-blue-500/20 w-8 h-8" />
                  </div>
               </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <div className="bg-[#0f1117] p-10 rounded-[3rem] border border-slate-800 min-h-[600px] relative">
              
              {activeSection === 'settings' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">Configuración <span className="text-orange-500 font-light">de Sede</span></h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 italic">Ajustes técnicos y perfil institucional</p>
                  </div>

                  <form onSubmit={handleUpdateInstitution} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 space-y-4">
                        <div className="flex items-center gap-3 text-orange-500 mb-2">
                           <Building2 size={16}/>
                           <span className="text-[10px] font-black uppercase tracking-widest">Perfil General</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Nombre de la Sede</label>
                          <input 
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white uppercase outline-none focus:border-orange-500"
                            value={institutionName}
                            onChange={(e) => setInstitutionName(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 space-y-4">
                        <div className="flex items-center gap-3 text-blue-500 mb-2">
                           <Key size={16}/>
                           <span className="text-[10px] font-black uppercase tracking-widest">Identificador</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase ml-1">InstitutoId (Referencia)</label>
                          <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-mono font-bold text-slate-500 truncate">
                            {institutionId}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800">
                      <div className="flex items-center gap-3 text-slate-400 mb-6">
                         <Info size={16}/>
                         <span className="text-[10px] font-black uppercase tracking-widest">Auditoría de Recursos</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div>
                            <p className="text-[8px] font-black text-slate-600 uppercase">Aulas</p>
                            <p className="text-lg font-black text-white italic">{aulas.length}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black text-slate-600 uppercase">Tablets</p>
                            <p className="text-lg font-black text-white italic">{tablets.length}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black text-slate-600 uppercase">Alumnos</p>
                            <p className="text-lg font-black text-white italic">{allAlumnos.length}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black text-slate-600 uppercase">Sede</p>
                            <p className="text-lg font-black text-green-500 italic">ON</p>
                         </div>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="w-full bg-orange-500 text-white p-5 rounded-2xl text-[10px] font-black uppercase italic hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
                    >
                      {isSaving ? <Zap className="animate-spin" size={16}/> : <Save size={16}/>}
                      Aplicar Configuración
                    </button>
                  </form>
                </div>
              )}

              {activeSection === 'monitoring' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">Activity <span className="text-orange-500 font-light">Reports</span></h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 italic">Historial unificado y exportación de logs</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input placeholder="FILTRAR..." className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-[10px] font-bold uppercase text-white outline-none focus:border-orange-500" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {tablets.filter(t => t.alumno_asignado?.toLowerCase().includes(reportFilter.toLowerCase())).map((tablet) => (
                        <div key={tablet.id} className="flex items-center justify-between p-5 bg-slate-900/30 rounded-3xl border border-slate-800/50 hover:bg-slate-800/20 transition-all">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700"><Tablet size={16} className="text-slate-500" /></div>
                               <div>
                                  <p className="text-xs font-black text-white uppercase italic">{tablet.alumno_asignado || 'DISPOSITIVO LIBRE'}</p>
                                  <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">ID: {tablet.id}</p>
                               </div>
                            </div>
                            <button onClick={() => setHistoryModal({ isOpen: true, tabletId: tablet.id, alumnoNombre: tablet.alumno_asignado })} className="px-6 py-3 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl text-[9px] font-black uppercase italic transition-all border border-orange-500/20">Generar Log</button>
                        </div>
                      ))}
                    </div>
                </div>
              )}

              {activeSection === 'dashboard' && !selectedAula && (
                <>
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Mapa <span className="text-orange-500 font-light">de Aulas</span></h2>
                    <button 
                      onClick={() => { setEditingAula(null); setNewAula({nombre_completo:'', seccion:''}); setShowModal(true); }} 
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Crear Nueva Aula
                    </button>
                  </div>
                  <div className="mb-12"><SecurityRules institutionId={institutionId!} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {aulas.map((aula) => (
                      <button key={aula.id} onClick={() => setSelectedAula(aula)} className="bg-slate-900/30 p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500 transition-all group text-left relative overflow-hidden">
                        <DoorOpen className="w-8 h-8 text-slate-700 mb-4 group-hover:text-orange-500 transition-colors" />
                        <h3 className="text-xl font-black italic uppercase text-white leading-tight">{aula.nombre_completo}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{aula.seccion || 'SIN SECCIÓN'}</p>
                        
                        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div onClick={(e) => handleEditAula(e, aula)} className="p-2 bg-slate-800 hover:text-orange-500 rounded-lg transition-colors"><Edit3 size={14} /></div>
                          <div onClick={(e) => handleDeleteAula(e, aula.id)} className="p-2 bg-slate-800 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></div>
                        </div>
                        
                        <div className="absolute right-6 bottom-6 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="text-orange-500" /></div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {selectedAula && activeSection === 'dashboard' && (
                <>
                  <button onClick={() => setSelectedAula(null)} className="mb-8 flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-orange-500 transition-all"><ArrowLeft className="w-3 h-3" /> Regresar</button>
                  <div className="grid grid-cols-1 gap-4">
                    {alumnos.map((alumno) => {
                      const device = tablets.find(t => t.id === alumno.tabletId);
                      return (
                        <div key={alumno.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-900/50 rounded-[2rem] border border-slate-800 group hover:border-orange-500/40 transition-all gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="relative">
                              <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700"><User className={device?.online ? "text-orange-500" : "text-slate-500"} /></div>
                              {device?.online && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0f1117] animate-pulse"></span>}
                            </div>
                            <div>
                              <p className="text-sm font-black uppercase text-white italic">{alumno.nombre}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${device?.online ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>{device?.online ? 'EN LÍNEA' : 'DESCONECTADO'}</span>
                                {device?.bateria && <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><Battery size={10} /> {device.bateria}%</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 bg-black/40 rounded-xl px-4 py-2 border border-slate-800/50 max-w-xs overflow-hidden">
                             <p className="text-[10px] font-medium text-slate-400 truncate italic">{device?.last_url || '...'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setMessageModal({ isOpen: true, tabletId: alumno.tabletId || '', alumnoNombre: alumno.nombre, text: '' })}
                              className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"
                            >
                              <MessageSquare className="w-5 h-5" />
                            </button>
                            <button onClick={() => setHistoryModal({ isOpen: true, tabletId: alumno.tabletId || "", alumnoNombre: alumno.nombre })} className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all"><Globe className="w-5 h-5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {activeSection === 'users' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Directorio <span className="text-orange-500 font-light">Global</span></h2>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input placeholder="BUSCAR..." className="bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-[10px] font-bold uppercase text-white w-72 outline-none focus:border-orange-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/20 text-[10px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-500 font-black uppercase">
                        <tr><th className="px-6 py-5">Alumno / HWID</th><th className="px-6 py-5">Aula</th><th className="px-6 py-5 text-right">Control</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {filteredUsers.map((alumno) => (
                          <tr key={alumno.id} className="hover:bg-slate-800/20 transition-colors group">
                            <td className="px-6 py-5 flex items-center gap-4">
                                <User size={14} className="text-slate-500" />
                                <div><p className="font-black text-white italic uppercase">{alumno.nombre}</p><p className="text-[8px] text-slate-600 uppercase">HWID: {alumno.tabletId || '---'}</p></div>
                            </td>
                            <td className="px-6 py-5 font-black uppercase text-slate-400 italic">{aulas.find(a => a.id === alumno.aulaId)?.nombre_completo || 'N/A'}</td>
                            <td className="px-6 py-5 text-right flex gap-2 justify-end">
                               <button 
                                 onClick={() => setMessageModal({ isOpen: true, tabletId: alumno.tabletId || '', alumnoNombre: alumno.nombre, text: '' })}
                                 className="p-2.5 bg-slate-800 rounded-xl hover:text-blue-400 transition-all"
                               >
                                 <MessageSquare size={14} />
                               </button>
                               <button onClick={() => setHistoryModal({ isOpen: true, tabletId: alumno.tabletId || "", alumnoNombre: alumno.nombre })} className="p-2.5 bg-slate-800 rounded-xl hover:text-orange-500 transition-all"><Globe size={14} /></button>
                               <button onClick={() => { setEditingAlumno(alumno); setTempName(alumno.nombre); }} className="p-2.5 bg-slate-800 rounded-xl hover:text-blue-400 transition-all"><Edit2 size={14} /></button>
                               <button onClick={() => handleDeleteStudent(alumno)} className="p-2.5 bg-slate-800 rounded-xl hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL DE MENSAJERÍA DIRECTA */}
      {messageModal.isOpen && (
        <div className="fixed inset-0 bg-[#0a0c10]/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 text-blue-500 mb-2">
               <MessageSquare size={20} />
               <h2 className="text-xl font-black italic uppercase text-white">Mensaje <span className="text-blue-500 font-light">Directo</span></h2>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase mb-6">Alumno: <span className="text-white">{messageModal.alumnoNombre}</span></p>
            
            <textarea 
              placeholder="ESCRIBA LA ADVERTENCIA O INFRACCIÓN..." 
              className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase min-h-[120px] outline-none focus:border-blue-500 mb-6"
              value={messageModal.text}
              onChange={(e) => setMessageModal({...messageModal, text: e.target.value})}
            />
            
            <div className="flex gap-2">
               <button 
                onClick={handleSendMessage}
                disabled={isSaving || !messageModal.text.trim()}
                className="flex-1 bg-blue-600 hover:bg-white hover:text-blue-600 p-5 rounded-xl font-black uppercase text-white text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-20"
               >
                 <Send size={14} /> Enviar Alerta
               </button>
               <button onClick={() => setMessageModal({...messageModal, isOpen: false})} className="p-5 text-[9px] font-black uppercase text-slate-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {editingAlumno && (
        <div className="fixed inset-0 bg-[#0a0c10]/95 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black italic uppercase text-white mb-8">Editar <span className="text-blue-500">Nombre</span></h2>
            <input className={inputStyle} value={tempName} onChange={e => setTempName(e.target.value)} />
            <div className="flex gap-2 mt-6">
               <button onClick={handleUpdateName} className="flex-1 bg-blue-600 p-5 rounded-xl font-black uppercase text-white text-xs">Guardar</button>
               <button onClick={() => setEditingAlumno(null)} className="p-5 text-[9px] font-black uppercase text-slate-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-[#0a0c10]/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in">
            <h2 className="text-3xl font-black italic uppercase text-white mb-8">
              {editingAula ? 'Editar' : 'Nueva'} <span className="text-orange-500">Aula</span>
            </h2>
            <form onSubmit={handleSaveAula} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase italic ml-1">Nombre del Aula</label>
                <input placeholder="EJ: LABORATORIO" className={inputStyle} value={newAula.nombre_completo} onChange={e => setNewAula({...newAula, nombre_completo: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase italic ml-1">Aula / Sección</label>
                <input placeholder="EJ: 5TO AÑO B" className={inputStyle} value={newAula.seccion} onChange={e => setNewAula({...newAula, seccion: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <button 
                  type="button"
                  onClick={() => { setShowModal(false); setEditingAula(null); }} 
                  className="bg-slate-800 text-slate-400 font-black py-5 rounded-xl text-[10px] uppercase italic hover:bg-slate-700 transition-all"
                >
                  Salir
                </button>
                <button type="submit" className="bg-orange-500 text-white font-black py-5 rounded-xl text-[10px] uppercase italic hover:bg-orange-600 transition-all">
                  {editingAula ? 'Actualizar' : 'Desplegar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <WebHistoryModal isOpen={historyModal.isOpen} onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} tabletId={historyModal.tabletId} alumnoNombre={historyModal.alumnoNombre} />
    </div>
  );
}
