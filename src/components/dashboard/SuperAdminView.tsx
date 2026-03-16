'use client';
import React, { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config'; // Importamos rtdb
import { 
  collection, onSnapshot, query, where, serverTimestamp, 
  orderBy, limit, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, setDoc, getDocs, getDoc 
} from 'firebase/firestore';
import { ref, onValue, set, update, remove, query as queryRTDB, orderByKey, limitToLast, get } from 'firebase/database';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ShieldCheck, Users, Zap, QrCode, Play, Tablet, Building2, ShieldAlert, 
  Plus, X, Smartphone, Lock, Eye, EyeOff, Layout, GraduationCap, Briefcase, Trash2, Edit3, Globe, CheckCircle2, AlertCircle, Settings2, DoorOpen, Save, Search, Layers, RefreshCcw
} from 'lucide-react';

import CreateInstitutionForm from '@/components/super-admin/create-institution-form';
import InstitutionList from '@/components/super-admin/institution-list';
import UserManagement from '@/components/admin/users/UserManagement';

export default function SuperAdminView() {
  const [lastDeviceId, setLastDeviceId] = useState('');
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
  
  const [selectedConfig, setSelectedConfig] = useState({ 
    instId: '', 
    seccion: '',
    aulaId: '', 
    rol: 'alumno' 
  });
  
  const [lastLinkedDevice, setLastLinkedDevice] = useState<any>(null);
  const [studentName, setStudentName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [vinculationMode, setVinculationMode] = useState<"sencilla" | "rafaga">("sencilla");
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

  // --- NUEVAS FUNCIONES DE GESTIÓN INDIVIDUAL ---

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm(`¿ESTÁS SEGURO DE ELIMINAR EL DISPOSITIVO ${deviceId}? Esta acción es irreversible.`)) return;
    try {
      // 1. Buscamos si hay un usuario vinculado a este deviceId en Firestore
      const uQ = query(collection(db, "usuarios"), where("deviceId", "==", deviceId));
      const uSnap = await getDocs(uQ);
      
      // 2. Eliminamos los registros de usuario encontrados
      const deletePromises = uSnap.docs.map(d => deleteDoc(doc(db, "usuarios", d.id)));
      await Promise.all(deletePromises);

      // 3. Eliminamos de Realtime Database
      await remove(ref(rtdb, `dispositivos/${deviceId}`));
      
      alert("✅ DISPOSITIVO Y USUARIOS ASOCIADOS ELIMINADOS");
    } catch (e) { console.error("Error al eliminar dispositivo:", e); }
  };

  const handleUpdateDeviceName = async (deviceId: string, currentName: string) => {
    const newName = prompt(`REASIGNAR DISPOSITIVO ${deviceId}\nIngrese el nuevo nombre del alumno:`, currentName);
    if (!newName || newName === currentName) return;

    try {
      // 1. Actualizamos el nombre en RTDB
      await update(ref(rtdb, `dispositivos/${deviceId}`), {
        alumno_asignado: newName.trim(),
        lastUpdated: Date.now()
      });

      // 2. Buscamos y actualizamos el nombre en el documento de usuario de Firestore
      const uQ = query(collection(db, "usuarios"), where("deviceId", "==", deviceId));
      const uSnap = await getDocs(uQ);

      if (!uSnap.empty) {
        const userDoc = uSnap.docs[0];
        await updateDoc(doc(db, "usuarios", userDoc.id), {
          nombre: newName.trim(),
          lastUpdated: serverTimestamp()
        });
      }
      alert("✅ DISPOSITIVO REASIGNADO A: " + newName);
    } catch (e) { console.error("Error al reasignar:", e); }
  };

  // --- LÓGICA DE DATOS ---

  // Obtener ID secuencial desde RTDB (Más rápido)
  const getNextDeviceId = async () => {
    const devicesRef = queryRTDB(ref(rtdb, 'dispositivos'), orderByKey(), limitToLast(1));
    const snap = await get(devicesRef);
    if (!snap.exists()) return "DEV-0001";
    
    const lastId = Object.keys(snap.val())[0];
    const lastNum = parseInt(lastId.split('-')[1]) || 0;
    return `DEV-${(lastNum + 1).toString().padStart(4, '0')}`;
  };

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

  // Escucha de Dispositivos en RTDB
  useEffect(() => {
    const devicesRef = ref(rtdb, 'dispositivos');
    const unsub = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        // Filtramos por aula si hay una seleccionada
        const filtered = targetAulaId 
          ? list.filter(d => d.aulaId === targetAulaId)
          : list;
        setDevices(filtered);
      } else {
        setDevices([]);
      }
    });
    return () => unsub();
  }, [targetAulaId]);

  // Listener para detectar vinculación en RTDB
  useEffect(() => {
    if (!isJornadaActive || !selectedConfig.instId) return;

    const devicesRef = ref(rtdb, 'dispositivos');
    const unsub = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const detected = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .find(d => d.InstitutoId === selectedConfig.instId && d.vinculado === true && !d.alumno_asignado);
        
        if (detected) setLastLinkedDevice(detected);
      }
    });
    return () => unsub();
  }, [isJornadaActive, selectedConfig.instId]);

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

  const getOrCreateDevice = async () => {
    const devicesRef = ref(rtdb, 'dispositivos');
    const snap = await get(devicesRef);
    const data = snap.val();

    // Buscar si hay uno pendiente para reciclar
    let existingId = null;
    if (data) {
      existingId = Object.keys(data).find(key => 
        data[key].status === "pending_hardware" && 
        data[key].aulaId === selectedConfig.aulaId &&
        data[key].seccion === selectedConfig.seccion.toUpperCase().trim()
      );
    }
    
    if (existingId) {
      console.log("♻️ Reciclando ID:", existingId);
      await update(ref(rtdb, `dispositivos/${existingId}`), {
        InstitutoId: selectedConfig.instId,
        rol: selectedConfig.rol,
        vinculado: false,
        createdAt: Date.now()
      });
      setLastDeviceId(existingId);
      return existingId;
    }

    const nextId = await getNextDeviceId();
    console.log("🆕 Creando nuevo ID:", nextId);
    await set(ref(rtdb, `dispositivos/${nextId}`), {
      createdAt: Date.now(),
      vinculado: false,
      InstitutoId: selectedConfig.instId,
      aulaId: selectedConfig.aulaId,
      seccion: selectedConfig.seccion.toUpperCase().trim(),
      rol: selectedConfig.rol,
      status: 'pending_hardware'
    });
    setLastDeviceId(nextId);
    return nextId;
  };

  const handleSaveStudent = async () => {
    if (!studentName || !lastLinkedDevice) return;
    setIsSaving(true);
    try {
      const selectedRole = selectedConfig.rol || 'alumno';
      
      // 1. Actualizar RTDB
      await update(ref(rtdb, `dispositivos/${lastLinkedDevice.id}`), {
        alumno_asignado: studentName.trim(),
        status: 'active',
        lastUpdated: Date.now(),
      });

      // 2. Crear Usuario Firestore
      const baseName = studentName.toLowerCase().trim().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const suffix = lastLinkedDevice.id.slice(-4);
      const customId = `${baseName}_${suffix}`;

      await setDoc(doc(db, "usuarios", customId), {
        nombre: studentName.trim(),
        rol: selectedRole,
        InstitutoId: selectedConfig.instId,
        aulaId: selectedConfig.aulaId,
        seccion: selectedConfig.seccion,
        deviceId: lastLinkedDevice.id,
        id: customId, 
        status: 'active',
        createdAt: serverTimestamp()
      });

      setLastLinkedDevice(null);
      setStudentName('');
      
      if (vinculationMode === 'rafaga') {
        await getOrCreateDevice();
        setSessionStartTime(new Date());
      } else {
        setIsJornadaActive(false);
        setLastDeviceId('');
      }
      alert("✅ DISPOSITIVO VINCULADO");
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const toggleExtremeSecurity = async (deviceId: string, currentStatus: boolean) => {
    // Nota: Si migraste a RTDB, esta función debería usar 'update(ref(rtdb...))'
    // Para mantener consistencia con tu Firestore actual:
    await updateDoc(doc(db, "dispositivos", deviceId), {
      "restrictions.extremeSecurity": !currentStatus,
      lastUpdated: serverTimestamp()
    });
  };

  // GENERACIÓN DE QR DINÁMICO
  const generateVincularQR = () => {
    return JSON.stringify({
      action: 'vincular', 
      deviceId: lastDeviceId, 
      InstitutoId: selectedConfig.instId,
      aulaId: selectedConfig.aulaId,
      seccion: selectedConfig.seccion,
      nombreInstituto: institutions.find(i => i.id === selectedConfig.instId)?.nombre ?? '',
      rol: selectedConfig.rol
    });
  };

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

  const filteredUsers = allUsers.filter(u => {
    const search = searchTerm.toLowerCase();
    return (
      u.nombre?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search) ||
      u.seccion?.toLowerCase().includes(search)
    );
  });

  const uniqueSectionsForVincular = Array.from(new Set(availableAulas.map((a: any) => a.seccion))).filter(Boolean);
  const uniqueSectionsForEdit = Array.from(new Set(editAulasList.map((a: any) => a.seccion))).filter(Boolean);

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
                              {availableAulas.filter(a => a.seccion === selectedConfig.seccion).map(a => <option key={a.id} value={a.id}>{a.aulaId}</option>)}
                            </select>

                            <div className="grid grid-cols-2 gap-4">
                              <button onClick={() => setSelectedConfig({...selectedConfig, rol: 'alumno'})} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${selectedConfig.rol === 'alumno' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50'}`}><GraduationCap size={20}/><span className="text-[8px] font-black uppercase">Alumno</span></button>
                              <button onClick={() => setSelectedConfig({...selectedConfig, rol: 'profesor'})} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${selectedConfig.rol === 'profesor' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50'}`}><Briefcase size={20}/><span className="text-[8px] font-black uppercase">Profesor</span></button>
                            </div>
                            
                            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800 mb-4">
                              <button onClick={() => setVinculationMode('sencilla')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${vinculationMode === 'sencilla' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>Sencilla</button>
                              <button onClick={() => setVinculationMode('rafaga')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${vinculationMode === 'rafaga' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Ráfaga</button>
                            </div>

                            <button disabled={!selectedConfig.aulaId}
                              onClick={async () => { 
                                if (!selectedConfig.aulaId || !selectedConfig.seccion) return;
                                setLastLinkedDevice(null);
                                await getOrCreateDevice();
                                setSessionStartTime(new Date()); 
                                setIsJornadaActive(true); 
                              }}
                              className="w-full bg-orange-500 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-lg shadow-orange-500/20"
                            >
                              Activar Estación
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-4">
                            <div className="bg-white p-6 rounded-[2rem] mb-8 border-[12px] border-slate-900">
                              <QRCodeSVG value={generateVincularQR()} size={240} level="L" />
                            </div>
                            {lastLinkedDevice ? (
                              <div className="w-full bg-slate-900 p-6 rounded-3xl border border-orange-500 animate-in zoom-in">
                                <label className="text-[8px] font-black text-orange-500 uppercase mb-2 block italic">Hardware: {lastLinkedDevice.hardware?.modelo || 'Detectado'}</label>
                                <input autoFocus className={inputStyle} placeholder="NOMBRE DEL ASIGNADO" value={studentName} onChange={e => setStudentName(e.target.value)} />
                                <button onClick={handleSaveStudent} className="w-full bg-green-600 text-white font-black py-4 rounded-xl text-[10px] mt-4 uppercase">Finalizar Vinculación</button>
                              </div>
                            ) : (
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-500 uppercase animate-pulse italic">Esperando señal del dispositivo...</p>
                                <p className="text-[8px] text-slate-600 mt-2 italic">ID: {lastDeviceId}</p>
                              </div>
                            )}
                            <button onClick={() => { setIsJornadaActive(false); setLastLinkedDevice(null); }} className="mt-8 text-[9px] font-black text-red-500/50 uppercase italic">Cerrar Sesión</button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </div>
                <div className="col-span-12 lg:col-span-7">
                  {/* Aquí el contenido lateral opcional */}
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
                    <select className={inputStyle} value={targetInstId} onChange={e => { setTargetInstId(e.target.value); setTargetAulaId(''); }}>
                      <option value="">-- SELECCIONAR --</option>
                      {institutions.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block italic">2. Filtrar Aula</label>
                    <select className={inputStyle} value={targetAulaId} onChange={e => setTargetAulaId(e.target.value)}>
                      <option value="">-- SELECCIONAR --</option>
                      {availableAulas.map(a => <option key={a.id} value={a.id}>{a.nombre_completo || a.aulaId}</option>)}
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
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {devices.map(device => (
                  <div key={device.id} className={`bg-[#0f1117] rounded-[2.5rem] border ${device.restrictions?.extremeSecurity ? 'border-red-600' : 'border-slate-800'} p-8 shadow-xl transition-all hover:border-orange-500/50`}>
                    <div className="flex justify-between items-start mb-4">
                      <Smartphone size={20} className={device.restrictions?.extremeSecurity ? 'text-red-500' : 'text-orange-500'} />
                      <div className="flex gap-2">
                         {/* BOTÓN REASIGNAR/MODIFICAR */}
                        <button onClick={() => handleUpdateDeviceName(device.id, device.alumno_asignado)} className="p-2 bg-slate-900 rounded-lg text-slate-500 hover:text-blue-500 transition-colors">
                          <RefreshCcw size={14} />
                        </button>
                        {/* BOTÓN ELIMINAR INDIVIDUAL */}
                        <button onClick={() => handleDeleteDevice(device.id)} className="p-2 bg-slate-900 rounded-lg text-slate-500 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="text-white font-black text-2xl italic uppercase truncate">{device.alumno_asignado || 'PENDIENTE'}</h3>
                    <p className="text-slate-600 text-[9px] mb-2 uppercase tracking-widest font-bold">{device.id}</p>
                    <p className="text-orange-500 text-[8px] font-black uppercase truncate italic">
                      {device.hardware?.marca || 'S/M'} {device.hardware?.modelo || ''}
                    </p>

                    <button 
                      onClick={() => toggleExtremeSecurity(device.id, !!device.restrictions?.extremeSecurity)} 
                      className={`w-full py-4 mt-6 rounded-xl font-black uppercase text-[10px] border-2 transition-all ${device.restrictions?.extremeSecurity ? 'bg-red-600 text-white border-red-600' : 'border-slate-800 text-slate-500 hover:text-white hover:border-orange-500'}`}
                    >
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
              {/* Lógica de edición de usuario existente... */}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
