'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { 
 collection, onSnapshot, query, where, addDoc, serverTimestamp, 
 orderBy, limit, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, setDoc, Timestamp 
} from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { QRCodeSVG } from 'qrcode.react';
import { 
 ShieldCheck, Users, Zap, QrCode, Play, Tablet, Building2, ShieldAlert, 
 Plus, X, Smartphone, Lock, Eye, EyeOff, Layout, GraduationCap, Briefcase, Trash2, Edit3, Globe, CheckCircle2, AlertCircle, Settings2, DoorOpen, Save, Search, Layers
} from 'lucide-react';

import CreateInstitutionForm from '@/components/super-admin/create-institution-form';
import InstitutionList from '@/components/super-admin/institution-list';
import UserManagement from '@/components/admin/users/UserManagement';

export default function SuperAdminView() {
  const { institutionId } = useInstitution();
  const [activeTab, setActiveTab] = useState('vincular'); 
  const [subTab, setSubTab] = useState<'master' | 'jornada'>('jornada');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [availableAulas, setAvailableAulas] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [targetInstId, setTargetInstId] = useState('');
  const [targetAulaId, setTargetAulaId] = useState('');
  const [currentAulaData, setCurrentAulaData] = useState<any>(null);

  const [isJornadaActive, setIsJornadaActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null); 
  
  // Estación de vinculación con selectores de precisión
  const [selectedConfig, setSelectedConfig] = useState({ 
    instId: '', 
    seccion: '',
    aulaId: '', 
    rol: 'alumno' 
  });
  
  const [lastLinkedDevice, setLastLinkedDevice] = useState<any>(null);
  const [studentName, setStudentName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [appToBlock, setAppToBlock] = useState('');

  const [appVersion, setAppVersion] = useState({ code: 1, url: '', force: true });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ 
    nombre: '', 
    InstitutoId: '', 
    seccionSeleccionada: '', 
    aulaIdFinal: '' 
  });
  const [editAulasList, setEditAulasList] = useState<any[]>([]);

  // Listeners Core
  useEffect(() => {
    return onSnapshot(doc(db, "config", "app_status"), (d) => {
      if (d.exists()) {
        const data = d.data();
        setAppVersion({
          code: data.versionCode || 1,
          url: data.downloadUrl || '',
          force: data.forceUpdate ?? true
        });
      }
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "institutions"), (s) => {
      setInstitutions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "usuarios"), where("role", "in", ["director", "profesor"]));
    return onSnapshot(q, (s) => {
      setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Carga dinámica de aulas para Vinculación y Filtros
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

  // Carga dinámica para Reasignación de Usuarios
  useEffect(() => {
    if (!editForm.InstitutoId) {
      setEditAulasList([]);
      return;
    }
    return onSnapshot(collection(db, `institutions/${editForm.InstitutoId}/Aulas`), (s) => {
      setEditAulasList(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [editForm.InstitutoId]);

  // Monitorización de Aula Específica (Pestaña Dispositivos)
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
    if (!isJornadaActive || !sessionStartTime) return; 
    const q = query(
      collection(db, "dispositivos"),
      where("status", "==", "pending_name"),
      where("createdAt", ">=", sessionStartTime),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    return onSnapshot(q, (s) => {
      if (!s.empty) {
        setLastLinkedDevice({ id: s.docs[0].id, ...s.docs[0].data() });
      }
    });
  }, [isJornadaActive, sessionStartTime]);

  // Funciones de Acción
  const handleUpdateAppVersion = async () => {
    try {
      await setDoc(doc(db, "config", "app_status"), {
        versionCode: Number(appVersion.code),
        downloadUrl: appVersion.url,
        forceUpdate: appVersion.force,
        updatedAt: serverTimestamp()
      });
      alert("🚀 Orden de actualización enviada a todas las tablets");
    } catch (e) { console.error(e); }
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditForm({ 
      nombre: user.nombre || '', 
      InstitutoId: user.InstitutoId || '',
      seccionSeleccionada: '', 
      aulaIdFinal: ''
    });
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !editForm.aulaIdFinal) return;
    const aulaSeleccionada = editAulasList.find(a => a.id === editForm.aulaIdFinal);
    try {
      await updateDoc(doc(db, "usuarios", editingUser.id), {
        nombre: editForm.nombre,
        InstitutoId: editForm.InstitutoId,
        seccion: aulaSeleccionada?.nombre_completo || '',
        lastUpdated: serverTimestamp()
      });
      setEditingUser(null);
      alert("✅ Operador reasignado exitosamente");
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('¿ELIMINAR ESTE OPERADOR?')) {
      try { await deleteDoc(doc(db, "usuarios", userId)); } catch (e) { console.error(e); }
    }
  };

  const handleSaveStudent = async () => {
    if (!studentName || !lastLinkedDevice) return;
    setIsSaving(true);
    try {
      const deviceId = lastLinkedDevice.serial || lastLinkedDevice.id;
      await setDoc(doc(db, "dispositivos", deviceId), {
        status: 'active',
        alumno_asignado: studentName,
        InstitutoId: selectedConfig.instId,
        aulaId: selectedConfig.aulaId,
        rol: selectedConfig.rol,
        deviceSerial: lastLinkedDevice.serial || 'N/A',
        lastUpdated: serverTimestamp(),
        restrictions: { extremeSecurity: false } 
      }, { merge: true });
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
    await updateDoc(aulaRef, { blacklistedApps: arrayRemove(appName) });
  };

  const toggleExtremeSecurity = async (deviceId: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "dispositivos", deviceId), {
      "restrictions.extremeSecurity": !currentStatus,
      lastUpdated: serverTimestamp()
    });
  };

  const handleCleanupInstitutions = async () => {
    if (!confirm("⚠️ ADVERTENCIA: ¿Eliminar sedes con IDs aleatorios?")) return;
    try {
      const toDelete = institutions.filter(inst => inst.id.length > 15);
      for (const inst of toDelete) { await deleteDoc(doc(db, "institutions", inst.id)); }
    } catch (e) { console.error(e); }
  };

  const filteredUsers = allUsers.filter(u => 
    u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.seccion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uniqueSectionsForEdit = Array.from(new Set(editAulasList.map(a => a.seccion))).filter(Boolean);
  const uniqueSectionsForVincular = Array.from(new Set(availableAulas.map(a => a.seccion))).filter(Boolean);

  const generateMasterQR = () => {
    const masterConfig = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_NAME": "com.educontrolpro",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.educontrolpro/.AdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": appVersion.url,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "bcofwtekjwPs7yqTj5kHv1ZqTS/n7JqEkN1b9R1GHZ0=",
      "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
      "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": true
    };
    return JSON.stringify(masterConfig);
  };

  const generateVincularQR = () => {
    return JSON.stringify({
      InstitutoId: selectedConfig.instId,
      aulaId: selectedConfig.aulaId,
      rol: selectedConfig.rol
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
              <h1 className="text-4xl font-black italic uppercase text-white tracking-tighter">EDU <span className="text-orange-500">ControlPro</span></h1>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 italic">Super Admin Control</p>
            </div>
        </header>

        <div className="p-10 max-w-[1700px] mx-auto">
          {activeTab === 'vincular' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4">
              <div className="flex gap-4">
                <button onClick={() => setSubTab('jornada')} className={`px-6 py-2 rounded-full text-[9px] font-black uppercase italic transition-all ${subTab === 'jornada' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>Jornada Estándar</button>
                <button onClick={() => setSubTab('master')} className={`px-6 py-2 rounded-full text-[9px] font-black uppercase italic transition-all ${subTab === 'master' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>Provisionamiento Master</button>
              </div>

              <div className="grid grid-cols-12 gap-10">
                <div className="col-span-12 lg:col-span-5">
                  <section className={`bg-[#0f1117] p-8 rounded-[3rem] border-2 shadow-2xl relative ${subTab === 'master' ? 'border-blue-500/20' : 'border-orange-500/20'}`}>
                    {subTab === 'master' ? (
                      <div className="text-center py-4">
                        <h2 className="text-xs font-black uppercase italic text-white flex items-center justify-center gap-2 mb-6"><Settings2 className="text-blue-500" size={18}/> Estación Master</h2>
                        <div className="bg-white p-6 rounded-[2rem] inline-block border-[12px] border-slate-900 mb-6">
                          <QRCodeSVG value={generateMasterQR()} size={240} level="M" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xs font-black uppercase italic text-white flex items-center gap-2 mb-8"><QrCode className="text-orange-500" size={18}/> Estación de Vinculación</h2>
                        {!isJornadaActive ? (
                          <div className="space-y-4">
                            <select className={inputStyle} onChange={e => setSelectedConfig({...selectedConfig, instId: e.target.value, seccion: '', aulaId: ''})}>
                              <option value="">1. SELECCIONAR SEDE</option>
                              {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                            </select>

                            <select className={inputStyle} disabled={!selectedConfig.instId} value={selectedConfig.seccion} onChange={e => setSelectedConfig({...selectedConfig, seccion: e.target.value, aulaId: ''})}>
                              <option value="">2. SELECCIONAR SECCIÓN</option>
                              {uniqueSectionsForVincular.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                            </select>

                            <select className={inputStyle} disabled={!selectedConfig.seccion} value={selectedConfig.aulaId} onChange={e => setSelectedConfig({...selectedConfig, aulaId: e.target.value})}>
                              <option value="">3. SELECCIONAR AULA EXACTA</option>
                              {availableAulas.filter(a => a.seccion === selectedConfig.seccion).map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                            </select>

                            <div className="grid grid-cols-2 gap-4">
                              <button onClick={() => setSelectedConfig({...selectedConfig, rol: 'alumno'})} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${selectedConfig.rol === 'alumno' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50'}`}><GraduationCap size={20}/><span className="text-[8px] font-black uppercase">Alumno</span></button>
                              <button onClick={() => setSelectedConfig({...selectedConfig, rol: 'profesor'})} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${selectedConfig.rol === 'profesor' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50'}`}><Briefcase size={20}/><span className="text-[8px] font-black uppercase">Profesor</span></button>
                            </div>
                            
                            <button disabled={!selectedConfig.aulaId} onClick={() => { setSessionStartTime(new Date()); setIsJornadaActive(true); }} className="w-full bg-orange-500 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-lg shadow-orange-500/20">Activar Estación</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-4">
                            <div className="bg-white p-6 rounded-[2rem] mb-8 border-[12px] border-slate-900">
                              <QRCodeSVG value={generateVincularQR()} size={240} level="L" />
                            </div>
                            {lastLinkedDevice ? (
                              <div className="w-full bg-slate-900 p-6 rounded-3xl border border-orange-500 animate-in zoom-in">
                                <label className="text-[8px] font-black text-orange-500 uppercase mb-2 block">Dispositivo Detectado</label>
                                <input autoFocus className={inputStyle} placeholder="NOMBRE DEL ALUMNO" value={studentName} onChange={e => setStudentName(e.target.value)} />
                                <button onClick={handleSaveStudent} className="w-full bg-green-600 text-white font-black py-4 rounded-xl text-[10px] mt-4 uppercase">Finalizar Vinculación</button>
                              </div>
                            ) : (
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-500 uppercase animate-pulse">Esperando vinculación...</p>
                                <p className="text-[8px] text-slate-600 mt-2">Aula: {availableAulas.find(a => a.id === selectedConfig.aulaId)?.nombre_completo}</p>
                              </div>
                            )}
                            <button onClick={() => { setIsJornadaActive(false); setLastLinkedDevice(null); }} className="mt-8 text-[9px] font-black text-red-500/50 uppercase">Cerrar Sesión</button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dispositivos' && (
            <div className="space-y-10 animate-in fade-in">
              <section className="bg-[#0f1117] p-8 rounded-[3rem] border-2 border-blue-500/20 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Globe size={120}/></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h2 className="text-xs font-black uppercase italic text-white flex items-center gap-2"><Globe className="text-blue-500" size={18}/> Panel APK Global</h2>
                  <button onClick={handleUpdateAppVersion} className="bg-blue-600 text-white text-[10px] font-black px-8 py-3 rounded-full shadow-lg shadow-blue-900/40">Publicar Actualización</button>
                </div>
                <div className="grid grid-cols-12 gap-6 relative z-10">
                  <div className="col-span-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">Version Code</label>
                    <input type="number" className={inputStyle} value={appVersion.code} onChange={e => setAppVersion({...appVersion, code: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="col-span-9">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block italic">URL Descarga (.apk)</label>
                    <input className={inputStyle} value={appVersion.url} onChange={e => setAppVersion({...appVersion, url: e.target.value})} placeholder="https://..." />
                  </div>
                </div>
              </section>

              <section className="bg-[#0f1117] p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
                <div className="grid grid-cols-12 gap-8 items-end">
                  <div className="col-span-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block italic">1. Filtrar Sede</label>
                    <select className={inputStyle} onChange={e => { setTargetInstId(e.target.value); setTargetAulaId(''); }}>
                      <option value="">-- SELECCIONAR --</option>
                      {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block italic">2. Filtrar Aula</label>
                    <select className={inputStyle} value={targetAulaId} onChange={e => setTargetAulaId(e.target.value)}>
                      <option value="">-- SELECCIONAR --</option>
                      {availableAulas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                    </select>
                  </div>
                  <div className="col-span-6">
                    <div className="h-[100px] flex items-center justify-between px-8 border-2 border-slate-800 rounded-3xl bg-black/20">
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase italic">Estado del Aula</p>
                        <div className="flex items-center gap-2 mt-1">
                          {targetAulaId ? <><div className="w-2 h-2 rounded-full animate-pulse bg-green-500" /><span className="text-xs font-black uppercase text-green-500">Monitorización Activa</span></> : <><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-xs font-black uppercase text-red-500">Sin Filtro</span></>}
                        </div>
                      </div>
                      <ShieldAlert className={targetAulaId ? 'text-orange-500' : 'text-slate-800'} size={32} />
                    </div>
                  </div>
                </div>
                {targetAulaId && (
                   <div className="mt-8 pt-8 border-t border-slate-800/50">
                    <div className="flex gap-4">
                      <input className={inputStyle} placeholder="COM.BLOQUEAR.APP" value={appToBlock} onChange={e => setAppToBlock(e.target.value)} />
                      <button onClick={addAppToAulaBlacklist} className="bg-orange-500 text-white px-6 rounded-xl font-black text-[10px] uppercase">Bloquear</button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {currentAulaData?.blacklistedApps?.map((app: string) => (
                        <div key={app} className="bg-slate-900 border border-red-500/30 px-3 py-1 rounded-full flex items-center gap-2">
                          <span className="text-[10px] font-mono text-red-400">{app}</span>
                          <button onClick={() => removeAppFromAulaBlacklist(app)}><X size={12}/></button>
                        </div>
                      ))}
                    </div>
                   </div>
                )}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {devices.map(device => (
                  <div key={device.id} className={`bg-[#0f1117] rounded-[2.5rem] border ${device.restrictions?.extremeSecurity ? 'border-red-600' : 'border-slate-800'} p-8`}>
                    <div className="flex justify-between items-start mb-4">
                      <Smartphone size={20} className={device.restrictions?.extremeSecurity ? 'text-red-500' : 'text-orange-500'} />
                      <span className="text-[8px] font-black uppercase italic px-2 py-1 bg-slate-900 rounded-lg">{device.rol}</span>
                    </div>
                    <h3 className="text-white font-black text-2xl italic uppercase truncate">{device.alumno_asignado || 'NO ASIGNADO'}</h3>
                    <p className="text-slate-600 text-[9px] mb-6 uppercase">SERIAL: {device.deviceSerial || device.id}</p>
                    <button onClick={() => toggleExtremeSecurity(device.id, !!device.restrictions?.extremeSecurity)} className={`w-full py-4 rounded-xl font-black uppercase text-[10px] border-2 ${device.restrictions?.extremeSecurity ? 'bg-red-600 text-white' : 'border-slate-800 text-slate-500 hover:text-white'}`}>
                      {device.restrictions?.extremeSecurity ? 'Desactivar Blindaje' : 'Activar Blindaje'}
                    </button>
                  </div>
                ))}
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
            <div className="space-y-12">
              <UserManagement />
              {editingUser && (
                <section className="bg-orange-500/5 border-2 border-orange-500 rounded-[2.5rem] p-8 animate-in slide-in-from-top-4 shadow-2xl">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="text-xs font-black uppercase italic text-white flex items-center gap-2"><Edit3 size={16} className="text-orange-500"/> Reasignación Global</h4>
                    <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-orange-500 ml-2 italic">Nombre</label>
                      <input className={inputStyle} value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-orange-500 ml-2 italic">1. Sede</label>
                      <select className={inputStyle} value={editForm.InstitutoId} onChange={e => setEditForm({...editForm, InstitutoId: e.target.value, seccionSeleccionada: '', aulaIdFinal: ''})}>
                        <option value="">SELECCIONAR SEDE</option>
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-orange-500 ml-2 italic">2. Sección</label>
                      <select className={inputStyle} disabled={!editForm.InstitutoId} value={editForm.seccionSeleccionada} onChange={e => setEditForm({...editForm, seccionSeleccionada: e.target.value, aulaIdFinal: ''})}>
                        <option value="">SELECCIONAR SECCIÓN</option>
                        {uniqueSectionsForEdit.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-orange-500 ml-2 italic">3. Aula Exacta</label>
                      <select className={inputStyle} disabled={!editForm.seccionSeleccionada} value={editForm.aulaIdFinal} onChange={e => setEditForm({...editForm, aulaIdFinal: e.target.value})}>
                        <option value="">SELECCIONAR AULA</option>
                        {editAulasList.filter(a => a.seccion === editForm.seccionSeleccionada).map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
                      </select>
                    </div>
                  </div>

                  <button onClick={handleUpdateUser} disabled={!editForm.aulaIdFinal} className="w-full mt-8 bg-orange-500 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl uppercase italic text-xs shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all">
                    <Save size={16}/> Confirmar Cambio de Jurisdicción
                  </button>
                </section>
              )}

              <section className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-slate-800 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xs font-black uppercase italic flex items-center gap-2"><Globe className="text-orange-500" size={16}/> Supervisión Global</h3>
                    <span className="text-[9px] font-black text-slate-500 uppercase">{filteredUsers.length} de {allUsers.length} Usuarios</span>
                  </div>
                  <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-orange-500 transition-colors" size={16} />
                    <input className="w-full bg-slate-900 border border-slate-800 pl-12 pr-4 py-3 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase transition-all" placeholder="BUSCAR POR NOMBRE, EMAIL O AULA..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-left">
                    <thead>
                      <tr className="text-slate-500 uppercase border-b border-slate-800/50 bg-slate-900/30">
                        <th className="p-6">Identidad</th>
                        <th className="p-6">Rol</th>
                        <th className="p-6">Sede Asignada</th>
                        <th className="p-6">Aula / Sección</th>
                        <th className="p-6 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-6">
                            <p className="text-white font-black uppercase text-[11px]">{u.nombre}</p>
                            <p className="text-slate-500 font-mono text-[9px]">{u.email}</p>
                          </td>
                          <td className="p-6">
                            <span className={`px-3 py-1 rounded-lg font-black uppercase text-[8px] ${u.role === 'director' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-6">
                            <p className="text-slate-300 font-bold uppercase">{institutions.find(i => i.id === u.InstitutoId)?.nombre || 'DESCONOCIDA'}</p>
                          </td>
                          <td className="p-6">
                             <div className="flex items-center gap-2">
                               <DoorOpen size={12} className="text-orange-500" />
                               <span className="text-white font-black uppercase italic">{u.seccion || 'SIN SECCIÓN'}</span>
                             </div>
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleEditClick(u)} className="p-3 bg-slate-800 hover:bg-orange-500/20 hover:text-orange-500 rounded-xl transition-all"><Edit3 size={14}/></button>
                              <button onClick={() => handleDeleteUser(u.id)} className="p-3 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 text-red-500/30 rounded-xl transition-all"><Trash2 size={14}/></button>
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
