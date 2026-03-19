'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db, rtdb } from '@/firebase/config';
import { 
  collection, query, where, getDocs, writeBatch, doc, onSnapshot 
} from 'firebase/firestore';
import { ref, onValue, remove } from 'firebase/database';
import { 
  ShieldAlert, Globe, Monitor, Trash2, Clock, CheckCircle, MessageSquare, History, 
  Search, Calendar, Download, Zap, AlertTriangle, Eraser, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

interface IncidentsTableProps {
  institutionId: string;
  onViewHistory?: (deviceId: string, alumnoNombre: string) => void;
  onSendMessage?: (deviceId: string, alumnoNombre: string) => void;
}

export function IncidentsTable({ institutionId, onViewHistory, onSendMessage }: IncidentsTableProps) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exportando, setExportando] = useState(false);

  // 1. Escucha Unificada
  useEffect(() => {
    if (!institutionId) return;

    const rtdbRef = ref(rtdb, 'system_analysis/blocked_attempts');
    const unsubscribeRTDB = onValue(rtdbRef, (snapshot) => {
      const data = snapshot.val();
      const rtdbItems = data ? Object.entries(data).map(([id, value]: [string, any]) => ({
        id,
        ...value,
        source: 'rtdb',
        timestamp: value.timestamp ? new Date(value.timestamp) : new Date()
      })).filter(item => item.InstitutoId === institutionId || !item.InstitutoId) : [];

      const q = query(
        collection(db, "alertas"),
        where("InstitutoId", "==", institutionId)
      );

      const unsubscribeFS = onSnapshot(q, (fsSnapshot) => {
        const fsItems = fsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          source: 'firestore',
          timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        }));

        const combined = [...rtdbItems, ...fsItems].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setIncidents(combined);
        setLoading(false);
      });

      return () => unsubscribeFS();
    });

    return () => unsubscribeRTDB();
  }, [institutionId]);

  // --- FUNCIÓN: LIMPIEZA TOTAL ---
  const clearAllIncidents = async () => {
    if (!confirm("⚠️ ¿BORRAR TODO? Esta acción limpiará la pantalla y eliminará todos los registros de hoy de la base de datos.")) return;
    
    setIsCleaning(true);
    try {
      await remove(ref(rtdb, 'system_analysis/blocked_attempts'));
      const q = query(collection(db, "alertas"), where("InstitutoId", "==", institutionId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
      await batch.commit();

      toast({
        title: "SISTEMA DEPURADO",
        description: "Se han eliminado todos los registros de la sesión actual.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error en limpieza"
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const filteredIncidents = useMemo(() => {
    let filtradas = incidents;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtradas = filtradas.filter(inc => 
        (inc.alumno_asignado?.toLowerCase().includes(term)) ||
        (inc.deviceId?.toLowerCase().includes(term)) ||
        (inc.aulaId?.toLowerCase().includes(term))
      );
    }
    return filtradas;
  }, [incidents, searchTerm]);

  if (loading) return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-16 text-center shadow-2xl">
      <Loader2 className="animate-spin w-8 h-8 text-orange-500 mx-auto mb-6" />
      <p className="text-orange-500 font-black text-[11px] uppercase tracking-[0.3em] italic">Sincronizando Centinela...</p>
    </div>
  );

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
      
      {/* Header */}
      <div className="p-8 border-b border-white/5 bg-gradient-to-br from-slate-900/50 to-transparent flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-black italic text-white uppercase flex items-center gap-3">
            <ShieldAlert className="text-orange-500 w-6 h-6 animate-pulse" /> Registro de <span className="text-orange-500 underline">Infracciones</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Sede Protegida • {incidents.length} Eventos
          </p>
        </div>

        <div className="flex items-center gap-3">
            <Button 
                onClick={clearAllIncidents}
                disabled={isCleaning || incidents.length === 0}
                variant="ghost"
                className="bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter px-4"
            >
                {isCleaning ? <Loader2 className="animate-spin mr-2" size={14}/> : <Eraser size={14} className="mr-2" />}
                Limpiar Pantalla
            </Button>

            <Button 
                onClick={() => setShowFilters(!showFilters)} 
                variant="outline"
                className="bg-slate-900 border-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-tighter"
            >
                <Search size={14} className="mr-2" /> {showFilters ? 'Cerrar' : 'Buscar'}
            </Button>
            
            <Button onClick={() => {}} className="bg-orange-500 hover:bg-orange-600 rounded-xl text-[10px] font-black uppercase">
                <Download size={14} />
            </Button>
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar bg-slate-950/20">
        {filteredIncidents.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center">
            <CheckCircle className="w-12 h-12 text-slate-800 mb-4" />
            <p className="text-slate-600 font-black uppercase text-[10px] tracking-[0.2em]">Monitor en Blanco: Sin incidencias</p>
          </div>
        ) : (
          filteredIncidents.map((inc: any) => (
            <div key={inc.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all">
               <div className="flex items-center gap-4 w-full">
                  <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500 shrink-0">
                    {inc.url ? <Globe size={20}/> : <Monitor size={20}/>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {/* CAMPO 1: ALUMNO ASIGNADO */}
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Alumno</p>
                      <p className="text-xs font-black text-white uppercase italic truncate">
                        {inc.alumno_asignado || inc.estudianteNombre || 'SIN NOMBRE'}
                      </p>
                    </div>

                    {/* CAMPO 2: AULA Y SECCION */}
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Ubicación</p>
                      <p className="text-xs font-black text-white uppercase italic">
                        {inc.aulaId || 'N/A'} - {inc.seccion || 'S/S'}
                      </p>
                    </div>

                    {/* CAMPO 3: ID DISPOSITIVO */}
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">ID Equipo</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        {inc.deviceId?.substring(0, 15) || 'NO_ID'}
                      </p>
                    </div>

                    {/* CAMPO 4: HORA E INFRACCION */}
                    <div className="text-right">
                      <p className="text-[8px] text-orange-500 font-black uppercase tracking-tighter">
                        {new Date(inc.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="text-[9px] text-red-500 font-bold truncate italic">
                        {inc.url || inc.descripcion || 'BLOQUEO'}
                      </p>
                    </div>
                  </div>
               </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-950/50 border-t border-white/5 text-center">
            <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] italic">EFAS ServiControl v2.4</p>
      </div>
    </div>
  );
}