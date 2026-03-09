'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { 
  collection, query, where, orderBy, limit, onSnapshot, Timestamp 
} from 'firebase/firestore';
import { ShieldAlert, Clock, X } from 'lucide-react';

interface Alerta {
  id: string;
  InstitutoId: string;
  aulaId?: string | null;
  estudianteNombre?: string;
  alumno_asignado?: string;
  descripcion?: string;
  url?: string;
  urlIntentada?: string;
  timestamp?: Timestamp | Date | string;
}

interface AlertFeedProps {
  aulaId: string;
  institutoId: string;
}

export function AlertFeed({ aulaId, institutoId }: AlertFeedProps) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!institutoId) return;

    const q = query(
      collection(db, "alertas"),
      where("InstitutoId", "==", institutoId),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Alerta[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Alerta));

      // Filtrar por aula si se proporciona: incluir las que no tienen aula (null) y las que coinciden
      const filtradas = aulaId 
        ? data.filter(alert => !alert.aulaId || alert.aulaId === aulaId)
        : data;

      setAlertas(filtradas);
    }, (error) => {
      console.error("Error cargando alertas:", error);
    });

    return () => unsubscribe();
  }, [aulaId, institutoId]);

  if (!show || alertas.length === 0) return null;

  const formatearHora = (timestamp?: Timestamp | Date | string) => {
    if (!timestamp) return 'Ahora';
    if (timestamp instanceof Timestamp) return timestamp.toDate().toLocaleTimeString();
    if (timestamp instanceof Date) return timestamp.toLocaleTimeString();
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleTimeString();
    return 'Ahora';
  };

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
                  {alert.estudianteNombre || alert.alumno_asignado || 'Estudiante'}
                </p>
                <span className="text-[8px] text-slate-500 font-bold italic">
                  <Clock size={8} className="inline mr-1" />
                  {formatearHora(alert.timestamp)}
                </span>
              </div>
              <p className="text-[9px] text-slate-300 font-medium leading-tight">
                {alert.descripcion || alert.urlIntentada || alert.url || 'Acceso bloqueado'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
