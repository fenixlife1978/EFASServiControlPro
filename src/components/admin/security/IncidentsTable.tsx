'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ShieldAlert, Globe, Monitor, Trash2, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function IncidentsTable({ institutionId }: { institutionId: string }) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar incidencias desde la colección global "alertas"
  useEffect(() => {
    if (!institutionId) return;

    const q = query(
      collection(db, "alertas"),
      where("InstitutoId", "==", institutionId),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
      }));
      setIncidents(data);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando incidencias:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId]);

  const markAsResolved = async (id: string) => {
    try {
      const alertRef = doc(db, "alertas", id);
      await updateDoc(alertRef, {
        status: 'visto',
        resolvedAt: new Date()
      });
    } catch (error) {
      console.error("Error marcando como visto:", error);
    }
  };

  const deleteIncident = async (id: string) => {
    if (!confirm("¿Eliminar este registro de infracción?")) return;
    
    try {
      const alertRef = doc(db, "alertas", id);
      await deleteDoc(alertRef);
    } catch (error) {
      console.error("Error eliminando incidencia:", error);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0f1117] border border-white/5 rounded-3xl p-10 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-orange-500 font-black text-[10px] uppercase tracking-widest">CARGANDO INCIDENCIAS...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
        <div>
          <h2 className="text-lg font-black italic text-white uppercase flex items-center gap-2">
            <ShieldAlert className="text-orange-500 w-5 h-5" /> Registro de Infracciones
          </h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Monitoreo de seguridad EDU • {incidents.length} evento{incidents.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
        {incidents.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldAlert className="w-12 h-12 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-600 font-black uppercase text-[10px] tracking-widest">
              Sistema Limpio - Sin Incidencias
            </p>
            <p className="text-[8px] text-slate-700 mt-2">TODO TRANQUILO EN CENTINELA</p>
          </div>
        ) : (
          incidents.map((inc: any) => (
            <div 
              key={inc.id} 
              className={`p-5 flex items-center justify-between transition-all ${
                inc.status === 'visto' ? 'opacity-40 bg-slate-900/20' : 'bg-orange-500/5 hover:bg-orange-500/10'
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-3 rounded-2xl ${
                  inc.status === 'visto' ? 'bg-slate-800' : 'bg-orange-500/20'
                }`}>
                  {inc.tipo?.includes('URL') || inc.url ? (
                    <Globe className={`w-5 h-5 ${inc.status === 'visto' ? 'text-slate-500' : 'text-orange-500'}`} />
                  ) : (
                    <Monitor className={`w-5 h-5 ${inc.status === 'visto' ? 'text-slate-500' : 'text-orange-500'}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-black text-sm uppercase">
                      {inc.estudianteNombre || inc.alumno_asignado || 'ALUMNO'}
                    </p>
                    {inc.deviceId && (
                      <span className="text-[8px] font-mono text-slate-600">
                        {inc.deviceId}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs font-medium italic mb-1">
                    {inc.descripcion || inc.urlIntentada || inc.url || 'Intento de acceso bloqueado'}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-slate-600 flex items-center gap-1 font-bold">
                      <Clock className="w-3 h-3" /> 
                      {inc.timestamp ? new Date(inc.timestamp).toLocaleString() : 'RECIENTE'}
                    </span>
                    {inc.tipo && (
                      <span className="text-[8px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">
                        {inc.tipo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 ml-4">
                {inc.status !== 'visto' && (
                  <Button 
                    onClick={() => markAsResolved(inc.id)}
                    className="bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white text-[10px] font-black rounded-xl h-8 px-3 border border-orange-600/20"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    VISTO
                  </Button>
                )}
                <Button 
                  onClick={() => deleteIncident(inc.id)}
                  variant="ghost"
                  size="icon"
                  className="text-slate-700 hover:text-red-500 h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}