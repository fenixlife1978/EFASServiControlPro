'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { 
  collection, onSnapshot, query, where, addDoc, serverTimestamp, 
  orderBy, limit, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc 
} from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ShieldCheck, Users, Zap, QrCode, Play, Tablet, Building2, ShieldAlert, 
  Plus, X, Smartphone, Lock, Eye, EyeOff, Layout, GraduationCap, Briefcase, Trash2, Edit3, Globe, CheckCircle2, AlertCircle
} from 'lucide-react';

import CreateInstitutionForm from '@/components/super-admin/create-institution-form';
import InstitutionList from '@/components/super-admin/institution-list';
import UserManagement from '@/components/admin/users/UserManagement';

export default function SuperAdminView() {
  const { institutionId } = useInstitution();
  const [activeTab, setActiveTab] = useState('vincular'); 
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [availableAulas, setAvailableAulas] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const [targetInstId, setTargetInstId] = useState('');
  const [targetAulaId, setTargetAulaId] = useState('');
  const [currentAulaData, setCurrentAulaData] = useState<any>(null);

  const [isJornadaActive, setIsJornadaActive] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState({ instId: '', aulaId: '', rol: 'alumno' });
  const [lastLinkedDevice, setLastLinkedDevice] = useState<any>(null);
  const [studentName, setStudentName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [appToBlock, setAppToBlock] = useState('');

  // Estados para Acciones Reales (Edición)
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ nombre: '', InstitutoId: '' });

  useEffect(() => {
    return onSnapshot(collection(db, "institutions"), (s) => {
      setInstitutions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // LISTADO DE PROFESORES Y DIRECTORES (Firestore query)
  useEffect(() => {
    const q = query(collection(db, "usuarios"), where("role", "in", ["director", "profesor"]));
    return onSnapshot(q, (s) => {
      setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    const instIdToLoad = activeTab === 'vincular' ? selectedConfig.instId : targetInstId;
    if (!instIdToLoad) {
      setAvailableAulas([]);
      return;
    }
    return onSnapshot(collection(db, `institutions/${instIdToLoad}/Aulas`), (s) => {
      setAvailableAulas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [targetInstId, selectedConfig.instId, activeTab]);

  useEffect(() => {
    if (!targetInstId || !targetAulaId) {
      setCurrentAulaData(null);
      return;
    }
    return onSnapshot(doc(db, `institutions/${targetInstId}/Aulas`, targetAulaId), (d) => {
      if (d.exists()) setCurrentAulaData({ id: d.id, ...d.data() });
    });
  }, [targetInstId, targetAulaId]);

  useEffect(() => {
    const q = targetAulaId 
      ? query(collection(db, "dispositivos"), where("aulaId", "==", targetAulaId))
      : query(collection(db, "dispositivos"));
    
    return onSnapshot(q, (s) => {
      setDevices(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [targetAulaId]);

  useEffect(() => {
    if (!isJornadaActive) return;
    const q = query(
      collection(db, "dispositivos"),
      where("status", "==", "pending_name"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    return onSnapshot(q, (s) => {
      if (!s.empty) {
        setLastLinkedDevice({ id: s.docs[0].id, ...s.docs[0].data() });
      }
    });
  }, [isJornadaActive]);

  // LOGICA DE ACCIONES REALES
  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditForm({ nombre: user.nombre || '', InstitutoId: user.InstitutoId || '' });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, "usuarios", editingUser.id), {
        nombre: editForm.nombre,
        InstitutoId: editForm.InstitutoId,
        lastUpdated: serverTimestamp()
      });
      setEditingUser(null);
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('¿ELIMINAR ESTE OPERADOR?')) {
      try {
        await deleteDoc(doc(db, "usuarios", userId));
      } catch (e) { console.error(e); }
    }
  };

  const handleSaveStudent = async () => {
    if (!studentName || !lastLinkedDevice) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "dispositivos", lastLinkedDevice.id), {
        status: 'active',
        alumno_asignado: studentName,
        InstitutoId: selectedConfig.instId,
        aulaId: selectedConfig.aulaId,
        rol: selectedConfig.rol,
        lastUpdated: serverTimestamp(),
        restrictions: { extremeSecurity: false } 
      });
      setLastLinkedDevice(null);
      setStudentName('');
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const addAppToAulaBlacklist = async () => {
    if (!appToBlock || !targetInstId || !targetAulaId) return;
    const aulaRef = doc(db, `institutions/${targetInstId}/Aulas`, targetAulaId);
    await updateDoc(aulaRef, {
      blacklistedApps: arrayUnion(appToBlock.toLowerCase().trim()),
      lastSecurityUpdate: serverTimestamp()
    });
    setAppToBlock('');
  };

  const removeAppFromAulaBlacklist = async (appName: string) => {
    const aulaRef = doc(db, `institutions/${targetInstId}/Aulas`, targetAulaId);
    await updateDoc(aulaRef, {
      blacklistedApps: arrayRemove(appName)
    });
  };

  const toggleExtremeSecurity = async (deviceId: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "dispositivos", deviceId), {
      "restrictions.extremeSecurity": !currentStatus,
      lastUpdated: serverTimestamp()
    });
  };

  const generateDualQR = () => {
    const host = typeof window !== 'undefined' ? window.location.origin : '';
    return JSON.stringify({
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.efas.servicontrolpro/.DeviceAdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": `${host}/downloads/efas.apk`,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM": "bcofwtekjwPs7yqTj5kHv1ZqTS/n7JqEkN1b9R1GHZ0=",
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        "InstitutoId": selectedConfig.instId,
        "aulaId": selectedConfig.aulaId,
        "rol": selectedConfig.rol
      }
    });
  };

  const inputStyle = "w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase transition-all";

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans">
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#0f1117] border-r border-slate-800/50 flex flex-col items-center py-8 gap-8 z-50">
        <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20"><ShieldCheck className="text-white w-6 h-6" /></div>
        <div className="flex-1 flex flex-col gap-6 pt-10">
          <button onClick={() => setActiveTab('vincular')} className={`p-3 rounded-xl transition-all ${activeTab === 'vincular' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Zap className="w-5 h-5" /></button>
          <button onClick={() => setActiveTab('sedes')} className={`p-3 rounded-xl transition-all ${activeTab === 'sedes' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Building2 className="w-5 h-5" /></button>
          <button onClick={() => setActiveTab('usuarios')} className={`p-3 rounded-xl transition-all ${activeTab === 'usuarios' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Users className="w-5 h-5" /></button>
          <button onClick={() => setActiveTab('dispositivos')} className={`p-3 rounded-xl transition-all ${activeTab === 'dispositivos' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Tablet className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="pl-20">
        <header className="sticky top-0 z-40 bg-[#0a0c10]/80 backdrop-blur-md border-b border-slate-800/50 px-10 py-8 flex justify-between items-center">
           <div>
             <h1 className="text-4xl font-black italic uppercase text-white tracking-tighter">EFAS <span className="text-orange-500">ServiControlPro</span></h1>
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 italic">
                {activeTab === 'dispositivos' ? 'Consola de Blindaje Colectivo' : 'Super Admin Panel'}
             </p>
           </div>
        </header>

        <div className="p-10 max-w-[1700px] mx-auto">
          {activeTab === 'dispositivos' && (
            <div className="space-y-10 animate-in fade-in">
              <section className="bg-[#0f1117] p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
                <div className="grid grid-cols-12 gap-8 items-end">
                  <div className="col-span-12 lg:col-span-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block italic">1. Seleccionar Sede</label>
                    <select className={inputStyle} onChange={e => { setTargetInstId(e.target.value); setTargetAulaId(''); }}>
                      <option value="">-- SELECCIONAR INSTITUTO --</option>
                      {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-span-12 lg:col-span-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block italic">2. Seleccionar Aula</label>
                    <select className={inputStyle} value={targetAulaId} onChange={e => setTargetAulaId(e.target.value)}>
                      <option value="">-- SELECCIONAR AULA --</option>
                      {availableAulas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                    </select>
                  </div>
                  <div className="col-span-12 lg:col-span-6">
                    <div className="h-[100px] flex items-center justify-between px-8 border-2 border-slate-800 rounded-3xl bg-black/20">
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase italic">Estado de Filtro</p>
                        <div className="flex items-center gap-2 mt-1">
                          {targetAulaId ? (
                            <>
                              <div className="w-2 h-2 rounded-full animate-pulse bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                              <span className="text-xs font-black uppercase italic text-green-500">Protección Activa</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-xs font-black uppercase italic text-red-500">Protección Desactivada</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ShieldAlert className={targetAulaId ? 'text-orange-500' : 'text-slate-800'} size={32} />
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {devices.map(device => (
                  <div key={device.id} className={`bg-[#0f1117] rounded-[2.5rem] border ${device.restrictions?.extremeSecurity ? 'border-red-600/50 shadow-[0_0_40px_rgba(220,38,38,0.15)]' : 'border-slate-800'} p-0 overflow-hidden transition-all duration-500`}>
                    <div className="p-8 pb-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 text-orange-500">
                          <Smartphone size={20} className={device.restrictions?.extremeSecurity ? 'text-red-500' : ''} />
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase italic ${device.rol === 'profesor' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                          {device.rol === 'profesor' ? 'DOCENTE' : 'ESTUDIANTE'}
                        </div>
                      </div>
                      <h3 className="text-white font-black text-2xl italic uppercase truncate leading-none">{device.alumno_asignado || 'DISPOSITIVO LIBRE'}</h3>
                      <p className="text-slate-600 text-[9px] font-mono mt-2 uppercase">ID: {device.id}</p>
                    </div>
                    <div className="p-8 pt-0">
                      <button 
                        onClick={() => toggleExtremeSecurity(device.id, !!device.restrictions?.extremeSecurity)}
                        className={`w-full py-5 rounded-2xl font-black uppercase text-[10px] italic border-2 transition-all flex items-center justify-center gap-3 ${
                          device.restrictions?.extremeSecurity 
                            ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/40 hover:bg-red-700' 
                            : 'bg-transparent border-slate-800 text-slate-500 hover:border-orange-500/50 hover:text-white'
                        }`}
                      >
                        <ShieldAlert size={16} />
                        {device.restrictions?.extremeSecurity ? 'Desactivar Blindaje Total' : 'Activar Blindaje Total'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'vincular' && (
            <div className="grid grid-cols-12 gap-10 animate-in slide-in-from-bottom-4">
              <div className="col-span-12 lg:col-span-5">
                <section className="bg-[#0f1117] p-8 rounded-[3rem] border-2 border-orange-500/20 shadow-2xl relative">
                  <h2 className="text-xs font-black uppercase italic text-white flex items-center gap-2 mb-8"><QrCode className="text-orange-500" size={18}/> Estación QR Dual</h2>
                  {!isJornadaActive ? (
                    <div className="space-y-4">
                      <select className={inputStyle} onChange={e => setSelectedConfig({...selectedConfig, instId: e.target.value})}>
                        <option value="">Seleccionar Sede</option>
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                      </select>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setSelectedConfig({...selectedConfig, rol: 'alumno'})}
                          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selectedConfig.rol === 'alumno' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50'}`}
                        >
                          <GraduationCap size={20} className={selectedConfig.rol === 'alumno' ? 'text-orange-500' : 'text-slate-600'} />
                          <span className="text-[8px] font-black uppercase italic">Alumno</span>
                        </button>
                        <button 
                          onClick={() => setSelectedConfig({...selectedConfig, rol: 'profesor'})}
                          className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selectedConfig.rol === 'profesor' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50'}`}
                        >
                          <Briefcase size={20} className={selectedConfig.rol === 'profesor' ? 'text-orange-500' : 'text-slate-600'} />
                          <span className="text-[8px] font-black uppercase italic">Profesor</span>
                        </button>
                      </div>

                      <select className={inputStyle} value={selectedConfig.aulaId} onChange={e => setSelectedConfig({...selectedConfig, aulaId: e.target.value})}>
                        <option value="">Seleccionar Aula</option>
                        {availableAulas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                      </select>
                      <button disabled={!selectedConfig.instId} onClick={() => setIsJornadaActive(true)} className="w-full bg-orange-500 text-white font-black italic uppercase py-5 rounded-2xl transition-all disabled:opacity-30">Activar Estación</button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4 text-white">
                      <div className="bg-white p-6 rounded-[2rem] mb-8 border-[12px] border-slate-900 shadow-2xl">
                        <QRCodeSVG value={generateDualQR()} size={220} level="L" />
                      </div>
                      
                      <div className="text-center mb-6">
                        <p className="text-[10px] font-black text-orange-500 uppercase italic tracking-widest">{selectedConfig.rol === 'alumno' ? 'Perfil: Estudiante' : 'Perfil: Docente'}</p>
                      </div>

                      {lastLinkedDevice ? (
                        <div className="w-full bg-slate-900 p-6 rounded-3xl border border-orange-500 animate-in zoom-in">
                          <p className="text-[8px] font-bold text-orange-500 mb-2 uppercase tracking-widest">ID Detectado: {lastLinkedDevice.id}</p>
                          <input autoFocus className={inputStyle} placeholder={selectedConfig.rol === 'alumno' ? "NOMBRE DEL ALUMNO" : "NOMBRE DEL PROFESOR"} value={studentName} onChange={e => setStudentName(e.target.value)} />
                          <button onClick={handleSaveStudent} className="w-full bg-green-600 text-white font-black py-4 rounded-xl text-[10px] mt-4 uppercase italic">Vincular Ahora</button>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-slate-500 uppercase animate-pulse italic tracking-[0.2em]">Esperando escaneo...</p>
                      )}
                      <button onClick={() => setIsJornadaActive(false)} className="mt-8 text-[9px] font-black text-red-500/50 uppercase tracking-widest">Cerrar Sesión</button>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {activeTab === 'sedes' && (
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-12 lg:col-span-5"><CreateInstitutionForm /></div>
              <div className="col-span-12 lg:col-span-7"><InstitutionList /></div>
            </div>
          )}

          {activeTab === 'usuarios' && (
            <div className="space-y-12 animate-in fade-in">
              <UserManagement />

              {/* GESTIÓN DE ACCIONES REALES PARA USUARIOS */}
              {editingUser && (
                <section className="bg-orange-500/10 border-2 border-orange-500 rounded-[2.5rem] p-8 animate-in zoom-in">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xs font-black text-white uppercase italic">Modificar Operador: {editingUser.email}</h4>
                    <button onClick={() => setEditingUser(null)}><X size={20}/></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className={inputStyle} value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} placeholder="Nombre" />
                    <select className={inputStyle} value={editForm.InstitutoId} onChange={e => setEditForm({...editForm, InstitutoId: e.target.value})}>
                      <option value="">Cambiar Sede</option>
                      {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                  </div>
                  <button onClick={handleUpdateUser} className="w-full mt-4 bg-orange-500 text-white font-black py-4 rounded-xl text-[10px] uppercase italic">Actualizar Datos</button>
                </section>
              )}

              <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] overflow-hidden">
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-black/20">
                  <h3 className="text-xs font-black text-white uppercase italic flex items-center gap-2"><Globe className="text-orange-500" size={16}/> Supervisión de Operadores</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-left">
                    <thead>
                      <tr className="text-slate-500 uppercase italic border-b border-slate-800/50">
                        <th className="p-6">Nombre / Email</th>
                        <th className="p-6">Rol</th>
                        <th className="p-6">Sede Asignada</th>
                        <th className="p-6 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {allUsers.map(u => (
                        <tr key={u.id} className="hover:bg-white/[0.02]">
                          <td className="p-6">
                            <p className="text-white font-black uppercase italic">{u.nombre || 'Sin Nombre'}</p>
                            <p className="text-slate-500 lowercase">{u.email}</p>
                          </td>
                          <td className="p-6">
                            <span className="px-3 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-black uppercase italic border border-orange-500/20">{u.role}</span>
                          </td>
                          <td className="p-6 text-slate-400 font-mono font-bold">{u.InstitutoId || 'Sede no asignada'}</td>
                          <td className="p-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleEditClick(u)} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl"><Edit3 size={14}/></button>
                              <button onClick={() => handleDeleteUser(u.id)} className="p-3 bg-slate-800 text-red-500 hover:bg-red-600 hover:text-white rounded-xl"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
