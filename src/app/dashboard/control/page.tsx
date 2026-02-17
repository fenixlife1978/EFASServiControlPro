'use client';
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useInstitution } from '@/app/(admin)/institution-context';

export default function ProfesorMonitor() {
  const { institutionId } = useInstitution();
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    if (!institutionId) return;

    // Solo vemos alertas de este InstitutoId
    const q = query(
      collection(db, "alertas_seguridad"),
      where("InstitutoId", "==", institutionId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setAlertas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [institutionId]);

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-black italic uppercase text-slate-900">
        Monitor de <span className="text-orange-500">Aula</span>
      </h1>
      <p className="text-slate-400 font-bold mb-8">Alertas de Incumplimiento en Tiempo Real</p>

      <div className="grid gap-4">
        {alertas.map((alerta: any) => (
          <div key={alerta.id} className="bg-white border-l-8 border-red-500 p-4 rounded-2xl shadow-sm flex justify-between items-center">
            <div>
              <p className="font-black uppercase text-slate-800 italic">{alerta.alumnoNombre}</p>
              <p className="text-xs text-red-500 font-bold uppercase">{alerta.tipoInfraccion}</p>
            </div>
            <span className="text-slate-400 text-xs font-bold italic">{alerta.hora}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
