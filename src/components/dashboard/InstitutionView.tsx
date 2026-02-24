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
  ArrowLeft, Settings, Trash2, Zap, Save, Building2, Key, Info, Edit3, Link2, Check, X, HardDrive, Smartphone, MapPin, ShieldCheck
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { SecurityRules } from '@/components/admin/config/SecurityRules';

export default function InstitutionView() {
  const { institutionId, setInstitutionId } = useInstitution();
  const [institutionName, setInstitutionName] = useState('Cargando...');
  
  // ESTADO PARA LA SEDE (Configuración General)
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

  // ESTADO PARA NUEVAS AULAS (Identidad EDUControlPro)
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

  useEffect(() => {
    if (!selectedAula || !institutionId) { setAlumnos([]); return; }
    const q = query(collection(db, "usuarios"), 
              where("InstitutoId", "==", institutionId), 
              where("aulaId", "==", selectedAula.id),
              where("rol", "==", "alumno"));
    return onSnapshot(q, (s) => {
      setAlumnos(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [selectedAula, institutionId]);

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
    
    try {
      // Normalizamos el ID (Mayúsculas y sin espacios)
      const customAulaId = newAula.aulaId.toUpperCase().trim().replace(/\s+/g, '_');
      const aulaRef = doc(db, "institutions", institutionId, "Aulas", customAulaId);
      
      await setDoc(aulaRef, {
        aulaId: customAulaId,
        seccion: newAula.seccion.toUpperCase().trim(),
        InstitutoId: institutionId,
        status: 'active',
        createdAt: serverTimestamp(),
        lastSecurityUpdate: serverTimestamp()
      });

      setNewAula({ aulaId: '', seccion: '', status: 'active' });
      setShowModal(false);
      alert("✅ Aula creada con ID: " + customAulaId);
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = async () => {
    if (!messageModal.tabletId || !messageModal.text.trim()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "dispositivos", messageModal.tabletId), {
        pending_message: messageModal.text,
        message_timestamp: serverTimestamp(),
        message_sender: "Dirección Institucional"
      });
      setMessageModal({ ...messageModal, isOpen: false, text: '' });
    } catch (e) { console.error(e); }
    setIsSaving(false);
  };

  const handleDeleteAula = async (e: React.MouseEvent, aulaId: string) => {
    e.stopPropagation();
    if (!confirm('¿ELIMINAR ESTA AULA PERMANENTEMENTE?')) return;
    try { await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, aulaId)); } catch (e) { console.error(e); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, "usuarios", editingUser.id), {
        nombre: editingUser.nombre,
        aulaId: editingUser.aulaId,
        updatedAt: serverTimestamp()
      });
      setEditingUser(null);
      alert("✅ Usuario actualizado correctamente.");
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (userId: string, tabletId?: string) => {
    if (!confirm("¿ELIMINAR ESTE ALUMNO? SE DESVINCULARÁ LA TABLET AUTOMÁTICAMENTE.")) return;
    try {
      if (tabletId) {
        await updateDoc(doc(db, "dispositivos", tabletId), {
          alumno_asignado: "",
          aulaId: "",
          status: "available",
          last_url: "Desvinculado por Dirección"
        });
      }
      await deleteDoc(doc(db, "usuarios", userId));
      alert("✅ Alumno eliminado y Hardware liberado.");
    } catch (e) { console.error(e); }
  };

  const filteredUsers = allAlumnos.filter(a => 
    a.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.deviceId && a.deviceId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans">
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#0f1117] border-r border-slate-800/50 flex flex-col items-center py-8 gap-8 z-50">
        <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20"><ShieldAlert className="text-white w-6 h-6" /></div>
        <div className="flex-1 flex flex-col gap-6 pt-10">
          <button title="Tablero de Control" onClick={() => { setActiveSection('dashboard'); setSelectedAula(null); }} className={`p-3 rounded-xl transition-all ${activeSection === 'dashboard' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Activity className="w-5 h-5" /></button>
          <button title="U.S. Security Center" onClick={() => setActiveSection('security')} className={`p-3 rounded-xl transition-all ${activeSection === 'security' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><ShieldCheck className="w-5 h-5" /></button>
          <button title="Directorio Global" onClick={() => setActiveSection('users')} className={`p-3 rounded-xl transition-all ${activeSection === 'users' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Users className="w-5 h-5" /></button>
          <button title="Configuración de Sede" onClick={() => setActiveSection('settings')} className={`p-3 rounded-xl transition-all ${activeSection === 'settings' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Settings className="w-5 h-5" /></button>
        </div>
        <button title="Cerrar Sesión" onClick={() => signOut(auth)} className="p-3 text-slate-600 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
      </nav>

      <main className="pl-20">
        <header className="sticky top-0 z-40 bg-[#0a0c10]/80 backdrop-blur-md border-b border-slate-800/50 px-8 py-6 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.4em] text-orange-500 mb-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
              EDUControlPro Sistema de Control Parental Educativo v3.0
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
          </div>

          <div className="col-span-12 lg:col-span-8">
            <div className="bg-[#0f1117] p-10 rounded-[3rem] border border-slate-800 min-h-[600px] relative">
              
              {activeSection === 'dashboard' && !selectedAula && (
                <>
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Mapa <span className="text-orange-500 font-light">de Aulas</span></h2>
                    <button onClick={() => { setEditingAula(null); setNewAula({aulaId:'', seccion:''}); setShowModal(true); }} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> Crear Nueva Aula</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {aulas.map((aula) => (
                      <button key={aula.id} onClick={() => setSelectedAula(aula)} className="bg-slate-900/30 p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500 transition-all group text-left relative">
                        <DoorOpen className="w-8 h-8 text-slate-700 mb-4 group-hover:text-orange-500" />
                        <h3 className="text-xl font-black italic uppercase text-white">{aula.aulaId}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{aula.seccion || 'SIN SECCIÓN'}</p>
                        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div title="Editar Aula" onClick={(e) => { e.stopPropagation(); setEditingAula(aula); setNewAula({aulaId: aula.aulaId, seccion: aula.seccion}); setShowModal(true); }} className="p-2 bg-slate-800 hover:text-orange-500 rounded-lg"><Edit3 size={14} /></div>
                          <div title="Eliminar Aula" onClick={(e) => handleDeleteAula(e, aula.id)} className="p-2 bg-slate-800 hover:text-red-500 rounded-lg"><Trash2 size={14} /></div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeSection === 'security' && (
                <div className="animate-in fade-in duration-500">
                  <SecurityRules institutionId={institutionId!} />
                </div>
              )}

              {activeSection === 'users' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Directorio <span className="text-orange-500 font-light">Global</span></h2>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input placeholder="BUSCAR POR NOMBRE O ID..." className="bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-[10px] font-bold uppercase text-white w-72 outline-none focus:border-orange-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/20">
                    <table className="w-full text-[10px]">
                      <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-500">
                        <tr>
                          <th className="px-6 py-5 text-left uppercase font-black italic">Alumno / Hardware</th>
                          <th className="px-6 py-5 text-left uppercase font-black italic">Aula Asignada</th>
                          <th className="px-6 py-5 text-right uppercase font-black italic">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((alumno) => {
                          const device = tablets.find(t => t.id === alumno.deviceId);
                          const isReq = activeUrlRequest === alumno.id;
                          return (
                            <tr key={alumno.id} className="border-b border-slate-800/30 hover:bg-slate-800/10 transition-all group">
                              <td className="px-6 py-5">
                                {editingUser?.id === alumno.id ? (
                                  <input className="bg-black border border-orange-500 rounded px-2 py-1 text-white uppercase text-[10px]" value={editingUser.nombre} onChange={e => setEditingUser({...editingUser, nombre: e.target.value})} />
                                ) : (
                                  <div>
                                    <p className="font-black text-white italic uppercase">{alumno.nombre}</p>
                                    <p className="text-[8px] font-bold text-blue-500 flex items-center gap-1 mt-1 opacity-70"><HardDrive size={10}/> {alumno.deviceId || 'NO VINCULADO'}</p>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                {editingUser?.id === alumno.id ? (
                                  <select className="bg-black border border-orange-500 rounded px-2 py-1 text-white uppercase text-[9px]" value={editingUser.aulaId} onChange={e => setEditingUser({...editingUser, aulaId: e.target.value})}>
                                    <option value="">SIN ASIGNAR</option>
                                    {aulas.map(a => <option key={a.id} value={a.id}>{a.aulaId}</option>)}
                                  </select>
                                ) : (
                                  <span className="uppercase font-bold text-slate-400">{alumno.aulaId || 'SIN AULA'}</span>
                                )}
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex gap-2 justify-end items-center">
                                  {isReq && device && (
                                    <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-lg animate-in fade-in slide-in-from-right-1">
                                      <p className="text-[7px] font-black text-orange-500 uppercase">En Vivo:</p>
                                      <p className="text-[9px] text-white font-medium truncate max-w-[120px]">{device.last_url || 'SISTEMA'}</p>
                                    </div>
                                  )}
                                  <button title="Consultar URL en Vivo" onClick={() => setActiveUrlRequest(isReq ? null : alumno.id)} className={`p-2 rounded-lg transition-all ${isReq ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}><Link2 size={14} /></button>
                                  <button title="Ver Historial Web" onClick={() => setHistoryModal({ isOpen: true, tabletId: alumno.deviceId || "", alumnoNombre: alumno.nombre })} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-orange-500 transition-all"><Globe size={14} /></button>
                                  <button title="Eliminar Alumno" onClick={() => handleDeleteUser(alumno.id, alumno.deviceId)} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedAula && activeSection === 'dashboard' && (
                <>
                  <button onClick={() => setSelectedAula(null)} className="mb-8 flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-orange-500"><ArrowLeft className="w-3 h-3" /> Regresar</button>
                  <div className="grid grid-cols-1 gap-4">
                    {alumnos.map((alumno) => {
                      const device = tablets.find(t => t.id === alumno.deviceId);
                      return (
                        <div key={alumno.id} className="flex items-center justify-between p-6 bg-slate-900/50 rounded-[2rem] border border-slate-800 gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center"><User className={device?.online ? "text-orange-500" : "text-slate-500"} /></div>
                            <div>
                              <p className="text-sm font-black uppercase text-white italic">{alumno.nombre}</p>
                              <span className="text-[8px] font-black text-slate-500 uppercase">{device?.online ? 'EN LÍNEA' : 'OFFLINE'}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button title="Enviar Mensaje" onClick={() => setMessageModal({ isOpen: true, tabletId: alumno.deviceId || '', alumnoNombre: alumno.nombre, text: '' })} className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center hover:bg-blue-500 transition-all group/msg"><MessageSquare className="w-5 h-5 group-hover/msg:text-white" /></button>
                            <button title="Ver Actividad" onClick={() => setHistoryModal({ isOpen: true, tabletId: alumno.deviceId || "", alumnoNombre: alumno.nombre })} className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center hover:bg-orange-500 transition-all group/globe"><Globe className="w-5 h-5 group-hover/globe:text-white" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {activeSection === 'settings' && (
                <div className="space-y-10">
                  <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">Configuración <span className="text-orange-500 font-light">de Sede</span></h2>
                    <button onClick={handleUpdateInstitution} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic transition-all flex items-center gap-2">
                      <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
                      <div className="flex items-center gap-3 text-orange-500 mb-2"><Building2 size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Perfil General</span></div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase italic ml-1">Nombre de la Sede</label>
                        <input className={inputStyle} value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase italic ml-1">Dirección Física</label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                          <input className={`${inputStyle} pl-12`} placeholder="Dirección Completa..." value={instData.direccion} onChange={(e) => setInstData({...instData, direccion: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase italic ml-1">Teléfono de Contacto</label>
                        <div className="relative">
                          <Smartphone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                          <input className={`${inputStyle} pl-12`} placeholder="+00 000 0000000" value={instData.telefono} onChange={(e) => setInstData({...instData, telefono: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-4">
                      <div className="flex items-center gap-3 text-blue-500 mb-2"><Key size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Identificador de Sede</span></div>
                      <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-500 truncate">{institutionId}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL DE AULA: aulaId y seccion */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0a0c10]/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-3xl font-black italic uppercase text-white mb-8">
              {editingAula ? 'Editar' : 'Nueva'} <span className="text-orange-500">Aula</span>
            </h2>
            <form onSubmit={handleSaveAula} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Aula / Grado</label>
                <input placeholder="EJ: LABORATORIO" className={inputStyle} value={newAula.aulaId || ""} onChange={e => setNewAula({...newAula, aulaId: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Sección</label>
                <input placeholder="EJ: 5TO AÑO B" className={inputStyle} value={newAula.seccion || ""} onChange={e => setNewAula({...newAula, seccion: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingAula(null); }} className="bg-slate-800 text-slate-400 font-black py-5 rounded-xl text-[10px] uppercase italic">Cancelar</button>
                <button type="submit" className="bg-orange-500 text-white font-black py-5 rounded-xl text-[10px] uppercase italic">Guardar Aula</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {messageModal.isOpen && (
        <div className="fixed inset-0 bg-[#0a0c10]/95 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md">
            <h2 className="text-xl font-black italic uppercase text-white mb-6">Comunicado: <span className="text-blue-500">{messageModal.alumnoNombre}</span></h2>
            <textarea className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase min-h-[120px] outline-none mb-6" value={messageModal.text} onChange={(e) => setMessageModal({...messageModal, text: e.target.value})} />
            <div className="flex gap-2">
               <button onClick={handleSendMessage} className="flex-1 bg-blue-600 p-5 rounded-xl font-black uppercase text-white text-[10px] italic">Transmitir Alerta</button>
               <button onClick={() => setMessageModal({...messageModal, isOpen: false})} className="p-5 text-[9px] font-black uppercase text-slate-600 italic">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <WebHistoryModal isOpen={historyModal.isOpen} onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} tabletId={historyModal.tabletId} alumnoNombre={historyModal.alumnoNombre} />
    </div>
  );
}
