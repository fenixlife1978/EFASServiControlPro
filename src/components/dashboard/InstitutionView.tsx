'use client';
import React, { useState, useEffect } from 'react';
import { db, auth, rtdb } from '@/firebase/config';
import { ref, onValue, update, remove } from 'firebase/database';
import { 
  collection, query, onSnapshot, doc, getDoc, setDoc, serverTimestamp 
} from 'firebase/firestore';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { 
  ShieldAlert, Activity, LogOut, Lock, Plus, DoorOpen, Globe, 
  ArrowLeft, Settings, Trash2, Smartphone, ShieldCheck, Edit3, 
  List, AlertTriangle, Calendar
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { GlobalControls } from '@/components/admin/config/GlobalControls';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import { SecurityAnalytics } from '@/components/admin/config/SecurityAnalytics'; 
import { WhitelistRules } from '@/components/admin/config/WhitelistRules';
import { BlacklistRules } from '@/components/admin/config/BlacklistRules';
import { BlockedAttempts } from '@/components/admin/monitoring/BlockedAttempts';

export default function InstitutionView() {
  const { institutionId, setInstitutionId } = useInstitution();
  const [institutionName, setInstitutionName] = useState('Cargando...');
  const [instData, setInstData] = useState<any>({ direccion: '', telefono: '' });
  const [activeSection, setActiveSection] = useState<'dashboard' | 'settings' | 'security' | 'lists' | 'blocked'>('dashboard');
  const [historyModal, setHistoryModal] = useState({ isOpen: false, deviceId: '', alumnoNombre: '' });
  const [aulas, setAulas] = useState<any[]>([]);
  const [tablets, setTablets] = useState<any[]>([]); 
  const [selectedAula, setSelectedAula] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newAula, setNewAula] = useState<any>({ aulaId: '', seccion: '', status: 'active' });
  const [isSaving, setIsSaving] = useState(false);

  
  const inputStyle = "w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase outline-none focus:border-orange-500 transition-all";

  const checkIsOnline = (lastPulse: number) => {
    if (!lastPulse) return "offline";
    const diff = Date.now() - lastPulse;
    return diff < 45000 ? "online" : "offline";
  };

  // --- LISTENERS DE FIREBASE Y RTDB ---
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

    // CORRECCIÓN: Apuntar a la colección raíz correcta "dispositivos"
    const rtTabletsRef = ref(rtdb, 'dispositivos');
    const unsubRTDB = onValue(rtTabletsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const filtrados = Object.keys(data)
          .map(key => ({ 
            id: key, 
            ...data[key] 
          }))
          // Filtramos por el InstitutoId (Case sensitive según tu RTDB)
          .filter(dev => String(dev.InstitutoId || "").trim() === String(institutionId).trim());
        
        setTablets(filtrados);
      } else {
        setTablets([]);
      }
    });

    return () => { unsubAulas(); unsubRTDB(); };
  }, [institutionId]);

  // --- FILTRADO POR AULA (BUSCANDO EN hardware O EN LA RAÍZ) ---
  useEffect(() => {
    if (selectedAula && tablets.length > 0) {
      const enAula = tablets.filter(dev => {
        // Buscamos aulaId y seccion dentro del objeto hardware o en la raíz (fallback)
        const devAula = String(dev.hardware?.aulaId || dev.aulaId || "").trim().toUpperCase();
        const devSecc = String(dev.hardware?.seccion || dev.seccion || "").trim().toUpperCase();
        
        const selAula = String(selectedAula.aulaId || "").trim().toUpperCase();
        const selSecc = String(selectedAula.seccion || "").trim().toUpperCase();
        
        return devAula === selAula && devSecc === selSecc;
      });
      setAlumnos(enAula);
    } else {
      setAlumnos([]);
    }
  }, [selectedAula, tablets]);

  const handleUpdateDeviceName = async (deviceId: string, currentName: string) => {
    const newName = prompt("NOMBRE DEL ALUMNO / DOCENTE:", currentName);
    if (!newName) return;
    try {
      // CORRECCIÓN: Ruta dispositivos/
      await update(ref(rtdb, `dispositivos/${deviceId}`), { 
        alumno_asignado: newName.toUpperCase() 
      });
      toast.success("Asignación actualizada");
    } catch (e) { toast.error("Error al actualizar"); }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm(`¿ELIMINAR DISPOSITIVO ${deviceId}?`)) return;
    try {
      // CORRECCIÓN: Ruta dispositivos/
      await remove(ref(rtdb, `dispositivos/${deviceId}`));
      toast.success("Registro eliminado");
    } catch (e) { toast.error("Error al eliminar"); }
  };

  const handleSaveAula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.aulaId || !newAula.seccion || !institutionId) return;
    setIsSaving(true);
    try {
      const cleanAula = newAula.aulaId.toUpperCase().trim();
      const cleanSeccion = newAula.seccion.toUpperCase().trim();
      const customId = `${cleanAula}_${cleanSeccion}`;
      
      await setDoc(doc(db, "institutions", institutionId, "Aulas", customId), {
        aulaId: cleanAula, 
        seccion: cleanSeccion,
        InstitutoId: institutionId, 
        status: 'active', 
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      setNewAula({ aulaId: '', seccion: '', status: 'active' });
      toast.success("Aula configurada");
    } catch (e) { toast.error("Error al guardar"); }
    setIsSaving(false);
  };

 
  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans">
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#0f1117] border-r border-slate-800/50 flex flex-col items-center py-8 gap-8 z-50">
        <div className="bg-orange-500 p-3 rounded-2xl shadow-lg shadow-orange-500/20"><ShieldAlert className="text-white w-6 h-6" /></div>
        <div className="flex-1 flex flex-col gap-6 pt-10">
          <button onClick={() => { setActiveSection('dashboard'); setSelectedAula(null); }} className={`p-3 rounded-xl transition-all ${activeSection === 'dashboard' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Activity className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('security')} className={`p-3 rounded-xl transition-all ${activeSection === 'security' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><ShieldCheck className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('settings')} className={`p-3 rounded-xl transition-all ${activeSection === 'settings' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><Settings className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('lists')} className={`p-3 rounded-xl transition-all ${activeSection === 'lists' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><List className="w-5 h-5" /></button>
          <button onClick={() => setActiveSection('blocked')} className={`p-3 rounded-xl transition-all ${activeSection === 'blocked' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-600 hover:text-white'}`}><AlertTriangle className="w-5 h-5" /></button>
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
                    <button onClick={() => setShowModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase italic flex items-center gap-2 shadow-lg shadow-orange-500/20">
                      <Plus className="w-4 h-4" /> Nueva Aula
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aulas.map((aula) => {
                      const count = tablets.filter(t => {
                        const tAula = String(t.hardware?.aulaId || t.aulaId || "").trim().toUpperCase();
                        const tSecc = String(t.hardware?.seccion || t.seccion || "").trim().toUpperCase();
                        return tAula === String(aula.aulaId || "").trim().toUpperCase() && 
                               tSecc === String(aula.seccion || "").trim().toUpperCase();
                      }).length;
                      return (
                        <div key={aula.id} onClick={() => setSelectedAula(aula)} className="bg-slate-900/30 p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500 transition-all group cursor-pointer relative">
                          <DoorOpen className="w-10 h-10 text-slate-700 mb-4 group-hover:text-orange-500 transition-colors" />
                          <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">{aula.aulaId}</h3>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SECCIÓN {aula.seccion}</p>
                            <span className="bg-orange-500/10 text-orange-500 text-[10px] px-3 py-1 rounded-full font-black italic">{count} UNIDADES</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              
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
                
                    </div>
                  </div>

                  <div className="space-y-4">
                    {alumnos.length === 0 ? (
                      <div className="py-20 text-center border border-dashed border-slate-800 rounded-[2rem] text-slate-700 font-black uppercase italic">
                        No hay unidades vinculadas en esta aula
                      </div>
                    ) : (
                      alumnos.map((alumno) => {
                        const status = checkIsOnline(alumno.lastSeen || alumno.lastPulse);
                        return (
                          <div key={alumno.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] flex items-center justify-between group hover:border-orange-500/50 transition-all">
                            <div className="flex items-center gap-5">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${status === 'online' ? 'bg-orange-500 shadow-lg shadow-orange-500/20' : 'bg-slate-800'} text-white`}>
                                <Smartphone size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-3 mb-1">
                                  <h4 className="font-black uppercase text-white italic text-lg leading-none">
                                    {alumno.alumno_asignado || "UNIDAD VINCULADA"}
                                  </h4>
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${alumno.estado === 'activo' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                    {alumno.estado || 'S/E'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-bold uppercase italic">
                                  <span className={status === "online" ? "text-green-500" : "text-red-500"}>
                                    ● {status === "online" ? "En Línea" : "Desconectado"}
                                  </span>
                                  <span className="text-slate-600">| ID: {alumno.id.slice(-8)}</span>
                                  {alumno.fechaVinculacion && (
                                    <span className="text-slate-600 flex items-center gap-1"><Calendar size={10}/> {new Date(alumno.fechaVinculacion).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleUpdateDeviceName(alumno.id, alumno.alumno_asignado)} className="p-3 bg-slate-800 hover:bg-blue-600 rounded-xl transition-all"><Edit3 size={16}/></button>
                              <button onClick={() => setHistoryModal({ isOpen: true, deviceId: alumno.id, alumnoNombre: alumno.alumno_asignado || alumno.id })} className="p-3 bg-slate-800 hover:bg-orange-500 rounded-xl transition-all"><Globe size={16}/></button>
                              <button onClick={() => handleDeleteDevice(alumno.id)} className="p-3 bg-slate-800 hover:bg-red-600 rounded-xl transition-all"><Trash2 size={16}/></button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'security' && <SecurityAnalytics />}
              {activeSection === 'lists' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">
                    Reglas de <span className="text-orange-500 font-light">Filtrado Master</span>
                  </h2>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                    <BlacklistRules />
                    <WhitelistRules />
                  </div>
                </div>
              )}
              {activeSection === 'blocked' && <BlockedAttempts />}
              {activeSection === 'settings' && (
                 <div className="space-y-10">
                  <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">Ajustes <span className="text-orange-500 font-light">de Sede</span></h2>
                  <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 max-w-md space-y-6">
                    <input className={inputStyle} value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Nombre sede" />
                    <input className={inputStyle} value={instData.direccion} onChange={(e) => setInstData({...instData, direccion: e.target.value})} placeholder="Dirección" />
                    <button className="w-full bg-orange-500 text-white font-black py-4 rounded-xl text-[10px] uppercase italic">Actualizar Sede</button>
                  </div>
                </div>
              )}
           
            </div>
          </div>
        </div>
      </main>


      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-10 w-full max-w-md">
            <h2 className="text-2xl font-black italic uppercase text-white mb-8">Nueva <span className="text-orange-500">Aula</span></h2>
            <form onSubmit={handleSaveAula} className="space-y-6">
              <input required className={inputStyle} placeholder="EJ: P1-001" value={newAula.aulaId} onChange={e => setNewAula({...newAula, aulaId: e.target.value})} />
              <input required className={inputStyle} placeholder="SECCIÓN: A" value={newAula.seccion} onChange={e => setNewAula({...newAula, seccion: e.target.value})} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-900 text-slate-500 font-black py-5 rounded-2xl text-[10px] uppercase">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-2 bg-orange-500 text-white font-black py-5 px-8 rounded-2xl text-[10px] uppercase disabled:opacity-50">
                  {isSaving ? 'Guardando...' : 'Crear Aula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {historyModal.isOpen && (
        <WebHistoryModal 
          isOpen={historyModal.isOpen} 
          onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} 
          deviceId={historyModal.deviceId} 
          alumnoNombre={historyModal.alumnoNombre} 
        />
      )}
    </div>
  );
}
