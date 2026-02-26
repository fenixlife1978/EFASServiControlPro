'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { 
  collection, query, where, orderBy, limit, onSnapshot 
} from 'firebase/firestore';
import { ShieldAlert, Clock, X } from 'lucide-react';

interface AlertFeedProps {
  aulaId: string;
  institutoId: string;
}

export function AlertFeed({ aulaId, institutoId }: AlertFeedProps) {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!aulaId || !institutoId) return;

    // Buscamos en la subcolección de incidencias de la institución
    const q = query(
      collection(db, `institutions/${institutoId}/incidencias`),
      where("aulaId", "==", aulaId),
      where("status", "==", "nuevo"),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAlertas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.log("Feed: Esperando datos..."));

    return () => unsub();
  }, [aulaId, institutoId]);

  if (!show || alertas.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-full max-w-sm animate-in slide-in-from-right duration-500">
      <div className="bg-[#1a0b0b] border-2 border-red-600/50 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="bg-red-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase italic tracking-widest">Infracción Detectada</span>
          </div>
          <button onClick={() => setShow(false)} className="opacity-50 hover:opacity-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {alertas.map((alert) => (
            <div key={alert.id} className="bg-black/40 border border-red-900/30 rounded-2xl p-4">
              <div className="flex justify-between items-start mb-1">
                <p className="text-red-500 text-[10px] font-black uppercase italic">
                  {alert.estudianteNombre || 'Estudiante'}
                </p>
                <span className="text-[8px] text-slate-500 font-bold italic">
                  <Clock size={8} className="inline mr-1" />
                  {alert.timestamp?.toDate ? alert.timestamp.toDate().toLocaleTimeString() : 'Ahora'}
                </span>
              </div>
              <p className="text-[9px] text-slate-300 font-medium leading-tight">
                {alert.detalle || alert.urlIntentada}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
