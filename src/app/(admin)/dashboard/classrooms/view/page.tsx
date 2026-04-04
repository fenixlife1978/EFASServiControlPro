'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db, rtdb } from '@/firebase/config';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { ref, update } from 'firebase/database';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import VincularUI from '@/components/VincularUI';
import AssignStudentModal from '@/components/admin/AssignStudentModal';
import DirectMessage from '@/components/admin/messaging/DirectMessage';
import { Tablet, ShieldCheck, ShieldAlert, Wifi, QrCode, X, UserRoundPen, MessageSquare, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

function MonitorContent() {
  const searchParams = useSearchParams();
  const { institutionId } = useInstitution();
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [messagingDevice, setMessagingDevice] = useState<any>(null);
  const [aulaSeccion, setAulaSeccion] = useState<string>('');
  
  // CORRECCIÓN ERROR 18047: Validación de nulidad para searchParams
  const aulaId = searchParams ? searchParams.get('id') : null;

  useEffect(() => {
    if (!institutionId || !aulaId) return;
    const aulaRef = doc(db, "institutions", institutionId, "Aulas", aulaId);
    const unsub = onSnapshot(aulaRef, (snap) => {
      if (snap.exists()) {
        setAulaSeccion(snap.data().seccion || '');
      }
    });
    return () => unsub();
  }, [institutionId, aulaId]);

  useEffect(() => {
    if (!institutionId || !aulaId) return;
    const q = query(
      collection(db, "dispositivos"), 
      where("InstitutoId", "==", institutionId), 
      where("aulaId", "==", aulaId)
    );
    const unsub = onSnapshot(q, (snaps) => {
      const devicesList = snaps.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        shield_mode_enable: d.data().shield_mode_enable || false,
        admin_mode_enable: d.data().admin_mode_enable || false,
        estado: d.data().estado || 'inactivo'
      }));
      setDispositivos(devicesList);
    });
    return () => unsub();
  }, [institutionId, aulaId]);

  const toggleModoBlindado = async (deviceId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await updateDoc(doc(db, "dispositivos", deviceId), {
        shield_mode_enable: newStatus,
        ultimo_comando: newStatus ? 'bloqueo_activado' : 'bloqueo_desactivado',
        ultimo_comando_ts: new Date().toISOString()
      });
      await update(ref(rtdb, `dispositivos/${deviceId}`), {
        shield_mode_enable: newStatus,
        last_command_ts: Date.now()
      });
      await update(ref(rtdb, `status_dispositivos/${deviceId}`), {
        shield_mode_enable: newStatus,
        last_command_ts: Date.now()
      });
    } catch (error) { 
      console.error('Error toggling shield mode:', error); 
    }
  };

  const toggleModoTecnico = async (deviceId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await updateDoc(doc(db, "dispositivos", deviceId), {
        admin_mode_enable: newStatus,
        ultimo_comando: newStatus ? 'modo_tecnico_activado' : 'modo_tecnico_desactivado',
        ultimo_comando_ts: new Date().toISOString()
      });
      await update(ref(rtdb, `dispositivos/${deviceId}`), {
        admin_mode_enable: newStatus,
        last_command_ts: Date.now()
      });
      await update(ref(rtdb, `status_dispositivos/${deviceId}`), {
        admin_mode_enable: newStatus,
        last_command_ts: Date.now()
      });
    } catch (error) { 
      console.error('Error toggling tech mode:', error); 
    }
  };

  const getDeviceStatus = (dev: any) => {
    if (dev.shield_mode_enable) return { label: 'BLOQUEADO', color: 'text-red-500', bg: 'bg-red-50', icon: ShieldAlert };
    if (dev.admin_mode_enable) return { label: 'MODO TÉCNICO', color: 'text-blue-500', bg: 'bg-blue-50', icon: Wifi };
    return { label: 'ACTIVO', color: 'text-emerald-500', bg: 'bg-emerald-50', icon: ShieldCheck };
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <header className="flex justify-between items-start mb-12">
        <div className="flex gap-6 items-start">
          <Link 
            href="/dashboard/classrooms" 
            className="mt-1 bg-white h-12 w-12 flex items-center justify-center rounded-2xl shadow-sm hover:shadow-orange-200 hover:scale-110 transition-all group border border-slate-100"
          >
            <ChevronLeft className="text-slate-400 group-hover:text-orange-500" />
          </Link>
          <div>
            <h1 className="text-5xl font-black italic uppercase text-slate-900 tracking-tighter">
              Monitor <span className="text-orange-500">En Vivo</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 italic">
              EDU ServControlPro • Aula: {aulaId} {aulaSeccion && `(Secc. ${aulaSeccion})`}
            </p>
          </div>
        </div>
        <button onClick={() => setShowQR(true)} className="bg-slate-900 hover:bg-orange-500 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs transition-all shadow-lg flex items-center gap-3">
          <QrCode className="w-4 h-4" /> Vincular Tablet
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dispositivos.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <Tablet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400 font-black uppercase text-sm italic">No hay dispositivos vinculados a este aula</p>
            <button onClick={() => setShowQR(true)} className="mt-4 text-orange-500 font-black uppercase text-xs underline">
              Vincular nuevo dispositivo
            </button>
          </div>
        ) : (
          dispositivos.map((dev) => {
            const status = getDeviceStatus(dev);
            const StatusIcon = status.icon;
            const isBlocked = dev.shield_mode_enable === true;
            const isTechMode = dev.admin_mode_enable === true;
            
            return (
              <div key={dev.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-all">
                <div className={`absolute top-0 left-0 w-full h-2 ${isBlocked ? 'bg-red-500' : isTechMode ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <Tablet className={`w-6 h-6 ${isBlocked ? 'text-slate-400' : 'text-orange-500'}`} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setMessagingDevice(dev)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingDevice(dev)} className="p-2 text-slate-300 hover:text-orange-500 transition-colors">
                      <UserRoundPen className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-black italic uppercase text-slate-800 leading-none mb-1">
                  {dev.alumno_asignado || "Sin Nombre"}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-3 tracking-widest">ID: {dev.id.slice(-8)}</p>
                
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${status.bg} mb-4`}>
                  <StatusIcon className={`w-3 h-3 ${status.color}`} />
                  <span className={`text-[8px] font-black uppercase ${status.color}`}>{status.label}</span>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => toggleModoBlindado(dev.id, isBlocked)}
                    className={`w-full py-3 rounded-2xl font-black uppercase italic text-[10px] transition-all flex items-center justify-center gap-2 ${
                      isBlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {isBlocked ? <><ShieldCheck className="w-4 h-4" /> Desbloquear</> : <><ShieldAlert className="w-4 h-4" /> Bloquear Dispositivo</>}
                  </button>
                  
                  <button 
                    onClick={() => toggleModoTecnico(dev.id, isTechMode)}
                    className={`w-full py-3 rounded-2xl font-black uppercase italic text-[10px] transition-all flex items-center justify-center gap-2 ${
                      isTechMode ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <Wifi className="w-4 h-4" />
                    {isTechMode ? 'Desactivar Modo Técnico' : 'Activar Modo Técnico'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showQR && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative">
            <button onClick={() => setShowQR(false)} className="absolute -top-4 -right-4 bg-white text-slate-900 p-2 rounded-full shadow-xl hover:bg-orange-500 hover:text-white transition-all z-10">
              <X className="w-6 h-6" />
            </button>
            <VincularUI />
          </div>
        </div>
      )}

      {editingDevice && (
        <AssignStudentModal 
          deviceId={editingDevice.id} 
          InstitutoId={institutionId || ""}
          aulaId={aulaId || ""}
          seccion={aulaSeccion}
          onClose={() => setEditingDevice(null)} 
        />
      )}

      {messagingDevice && (
        <DirectMessage 
          deviceId={messagingDevice.id}
          alumnoNombre={messagingDevice.alumno_asignado}
          userRole="director"
          onClose={() => setMessagingDevice(null)}
        />
      )}
    </div>
  );
}

export default function PaginaMonitor() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-black italic uppercase text-slate-400">Cargando Monitor...</div>}>
      <MonitorContent />
    </Suspense>
  );
}