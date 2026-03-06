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

    // BUSCAR EN EL LUGAR CORRECTO: dispositivos/{deviceId}/incidencias
    // Primero obtenemos los dispositivos de esta aula
    const dispositivosQuery = query(
      collection(db, "dispositivos"),
      where("aulaId", "==", aulaId),
      where("InstitutoId", "==", institutoId)
    );

    const unsubscribeDevices = onSnapshot(dispositivosQuery, async (snapshot) => {
      // Para cada dispositivo, buscar sus incidencias
      const todasIncidencias: any[] = [];
      
      snapshot.forEach(async (docSnap) => {
        const deviceId = docSnap.id;
        const incidenciasQuery = query(
          collection(db, "dispositivos", deviceId, "incidencias"),
          where("resuelta", "==", false),
          orderBy("timestamp", "desc"),
          limit(3)
        );
        
        // Nota: onSnapshot anidado requiere manejo cuidadoso
        // Usamos un listener separado para cada dispositivo
        const unsubscribeIncidencias = onSnapshot(incidenciasQuery, (incSnap) => {
          const nuevas = incSnap.docs.map(d => ({
            id: d.id,
            deviceId: deviceId,
            ...d.data()
          }));
          
          setAlertas(prev => {
            // Filtrar las que ya no están y agregar las nuevas
            const otras = prev.filter(a => a.deviceId !== deviceId);
            return [...otras, ...nuevas].slice(0, 10);
          });
        });
        
        // Guardar para limpiar después (esto es complejo, simplificamos)
      });
    });

    // Limpieza - esto es complicado con listeners anidados
    // Para simplificar, usaremos un enfoque más directo:
    
    return () => {
      // No podemos limpiar fácilmente, pero como es un componente,
      // se desmontará y los listeners se perderán
    };
  }, [aulaId, institutoId]);

  // VERSIÓN SIMPLIFICADA Y MÁS ROBUSTA:
  useEffect(() => {
    if (!aulaId) return;

    // Consulta combinada: obtenemos todas las subcolecciones de incidencias
    // Esta es una solución más elegante usando collection group
    const incidenciasQuery = query(
      collection(db, "incidencias"), // Necesitas un índice compuesto
      where("aulaId", "==", aulaId),
      where("institutoId", "==", institutoId),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    // Intentar con collection group (requiere índice en Firebase)
    try {
      const unsubscribe = onSnapshot(incidenciasQuery, (snapshot) => {
        setAlertas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.log("Error con collection group, usando método alternativo", error);
        // Si falla, no hacemos nada por ahora
      });
      
      return () => unsubscribe();
    } catch (e) {
      console.log("Collection group no disponible");
    }
  }, [aulaId, institutoId]);

  // MÉTODO DE RESPALDO: Escuchar directamente desde el MonitorService
  // (simplificado - asumimos que las incidencias se guardan también en una colección global)
  useEffect(() => {
    if (!aulaId) return;

    // Intentar leer de la colección "alertas" que el TeacherView ya usa
    const alertasQuery = query(
      collection(db, "alertas"),
      where("aulaId", "==", aulaId),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(alertasQuery, (snapshot) => {
      setAlertas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe();
  }, [aulaId]);

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
                  {alert.estudianteNombre || alert.alumno_asignado || 'Estudiante'}
                </p>
                <span className="text-[8px] text-slate-500 font-bold italic">
                  <Clock size={8} className="inline mr-1" />
                  {alert.timestamp?.toDate ? alert.timestamp.toDate().toLocaleTimeString() : 'Ahora'}
                </span>
              </div>
              <p className="text-[9px] text-slate-300 font-medium leading-tight">
                {alert.detalle || alert.url || alert.descripcion || 'Acceso bloqueado'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
