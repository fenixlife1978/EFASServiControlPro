'use client';

import React from 'react';
import { db } from '@/firebase/config';
import { 
  collection, query, orderBy, onSnapshot, 
  updateDoc, doc, deleteDoc 
} from 'firebase/firestore';
import { ShieldAlert, Globe, Monitor, Trash2, Clock, CheckCircle } from 'lucide-react';

export function IncidentsTable({ institutionId }: { institutionId: string }) {
  const [incidents, setIncidents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!institutionId) return;

    const q = query(
      collection(db, `institutions/${institutionId}/incidencias`),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [institutionId]);

  const markAsResolved = async (id: string) => {
    const docRef = doc(db, `institutions/${institutionId}/incidencias`, id);
    await updateDoc(docRef, { status: 'visto', resolvedAt: new Date() });
  };

  if (loading) return (
    <div className="p-20 text-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-[10px] font-black text-slate-500 uppercase italic">Escaneando registros de seguridad...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="bg-[#0a0c10] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {/* Header de la Tabla */}
        <div className="p-8 border-b border-slate-800 bg-gradient-to-r from-orange-500/10 to-transparent flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-3">
              <ShieldAlert className="text-orange-500" size={24} /> Log de Incidencias Global
            </h2>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">
              Historial de infracciones y bloqueos detectados por Centinela
            </p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl">
             <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest italic">
                {incidents.filter(i => i.status !== 'visto').length} Pendientes
             </span>
          </div>
        </div>

        {/* Listado */}
        <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
          {incidents.length === 0 ? (
            <div className="p-20 text-center opacity-30 italic">
               <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
               <p className="text-xs font-black uppercase tracking-widest">Sin infracciones registradas</p>
            </div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className={`p-6 flex items-center justify-between transition-all hover:bg-white/[0.02] ${inc.status === 'visto' ? 'opacity-40 grayscale' : ''}`}>
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl ${inc.status === 'visto' ? 'bg-slate-800 text-slate-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {inc.tipo === 'URL' ? <Globe size={20} /> : <Monitor size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-black text-sm uppercase italic tracking-tighter">{inc.estudianteNombre}</p>
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">Aula: {inc.aulaId || 'S/A'}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] font-medium leading-tight max-w-md break-all">{inc.detalle || inc.urlIntentada}</p>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="text-[9px] text-slate-600 font-black uppercase italic flex items-center gap-1 leading-none">
                         <Clock size={10} /> {inc.timestamp?.toDate().toLocaleString()}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {inc.status !== 'visto' && (
                    <button 
                      onClick={() => markAsResolved(inc.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black px-4 py-2 rounded-xl transition-all uppercase italic shadow-lg shadow-orange-500/20"
                    >
                      Marcar Visto
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="text-center">
         <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.4em] italic">
            EFAS ServiControlPro - Security Operations Center
         </p>
      </div>
    </div>
  );
}
