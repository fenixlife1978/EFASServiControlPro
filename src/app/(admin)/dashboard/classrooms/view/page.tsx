'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useInstitution } from '../../institution-context';
import EnrollmentQR from '@/components/admin/EnrollmentQR';
import AssignStudentModal from '@/components/admin/AssignStudentModal';
import DirectMessage from '@/components/admin/messaging/DirectMessage';
import { Tablet, ShieldCheck, ShieldAlert, Wifi, QrCode, X, UserRoundPen, MessageSquare } from 'lucide-react';

function MonitorContent() {
  const searchParams = useSearchParams();
  const { institutionId } = useInstitution();
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [messagingDevice, setMessagingDevice] = useState<any>(null);
  const aulaId = searchParams.get('id');

  useEffect(() => {
    if (!institutionId || !aulaId) return;
    const q = query(
      collection(db, "dispositivos"), 
      where("InstitutoId", "==", institutionId), 
      where("aulaId", "==", aulaId)
    );
    const unsub = onSnapshot(q, (snaps) => {
      setDispositivos(snaps.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [institutionId, aulaId]);

  const toggleBloqueo = async (deviceId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "dispositivos", deviceId), {
        comando_bloqueo: !currentStatus
      });
    } catch (error) { console.error(error); }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <header className="flex justify-between items-start mb-12">
        <div>
          <h1 className="text-5xl font-black italic uppercase text-slate-900 tracking-tighter">
            Monitor <span className="text-orange-500">En Vivo</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 italic">
            EFAS ServControlPro • Aula: {aulaId}
          </p>
        </div>
        <button onClick={() => setShowQR(true)} className="bg-slate-900 hover:bg-orange-500 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs transition-all shadow-lg flex items-center gap-3">
          <QrCode className="w-4 h-4" /> Vincular Tablet
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dispositivos.map((dev) => (
          <div key={dev.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-all">
            <div className={`absolute top-0 left-0 w-full h-2 ${dev.comando_bloqueo ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
            
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <Tablet className={`w-6 h-6 ${dev.comando_bloqueo ? 'text-slate-400' : 'text-orange-500'}`} />
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setMessagingDevice(dev)}
                  className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                  title="Enviar Mensaje"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setEditingDevice(dev)}
                  className="p-2 text-slate-300 hover:text-orange-500 transition-colors"
                  title="Editar Alumno"
                >
                  <UserRoundPen className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-black italic uppercase text-slate-800 leading-none mb-1">
              {dev.alumno_asignado || "Sin Nombre"}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-6 tracking-widest">ID: {dev.id}</p>

            <button 
              onClick={() => toggleBloqueo(dev.id, dev.comando_bloqueo)}
              className={`w-full py-4 rounded-2xl font-black uppercase italic text-[10px] transition-all flex items-center justify-center gap-2 ${
                dev.comando_bloqueo ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {dev.comando_bloqueo ? <><ShieldCheck className="w-4 h-4" /> Desbloquear</> : <><ShieldAlert className="w-4 h-4" /> Bloquear</>}
            </button>
          </div>
        ))}
      </div>

      {/* Modales */}
      {showQR && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative">
            <button onClick={() => setShowQR(false)} className="absolute -top-4 -right-4 bg-white text-slate-900 p-2 rounded-full shadow-xl hover:bg-orange-500 hover:text-white transition-all z-10">
              <X className="w-6 h-6" />
            </button>
            <EnrollmentQR InstitutoId={institutionId!} aulaId={aulaId!} />
          </div>
        </div>
      )}

      {editingDevice && (
        <AssignStudentModal 
          deviceId={editingDevice.id} 
          InstitutoId={institutionId || ""}
          aulaId={aulaId || ""}
          onClose={() => setEditingDevice(null)} 
        />
      )}

      {messagingDevice && (
        <DirectMessage 
          deviceId={messagingDevice.id}
          alumnoNombre={messagingDevice.alumno_asignado}
          userRole="director" // Forzamos el rol para este panel
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
