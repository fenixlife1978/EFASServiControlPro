'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, Clock, Globe, ShieldAlert, ShieldOff, ShieldCheck 
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Definición de Props para eliminar el error en page.tsx
interface ProfesorViewProps {
  professorId: string;
  institutoId: string;
}

interface Estudiante {
  id: string;
  nombre: string;
  deviceId: string;
  seccion: string;
  aulaId: string;
  bloqueado?: boolean;
}

interface Actividad {
  url: string;
  titulo: string;
  timestamp: any;
}

export default function ProfesorView({ professorId, institutoId }: ProfesorViewProps) {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [selectedAlumno, setSelectedAlumno] = useState<Estudiante | null>(null);
  const [historial, setHistorial] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);

  // Configuración de branding dinámico
  const profesorAula = "LABORATORIO"; 
  const institutoNombre = `SEDE: ${institutoId}`;

  useEffect(() => {
    // Consulta filtrada por el InstitutoId recibido por props
    const q = query(
      collection(db, "usuarios"),
      where("InstitutoId", "==", institutoId),
      where("aulaId", "==", profesorAula),
      where("role", "==", "estudiante")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: Estudiante[] = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() } as Estudiante);
      });
      setEstudiantes(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutoId, profesorAula]);

  useEffect(() => {
    if (!selectedAlumno) return;
    const qActividad = query(
      collection(db, "sesiones_monitoreo"),
      where("deviceId", "==", selectedAlumno.deviceId),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    const unsubscribeActividad = onSnapshot(qActividad, (snapshot) => {
      const logs: Actividad[] = [];
      snapshot.forEach((doc) => logs.push(doc.data() as Actividad));
      setHistorial(logs);
    });
    return () => unsubscribeActividad();
  }, [selectedAlumno]);

  const toggleBloqueo = async (alumno: Estudiante) => {
    try {
      const alumnoRef = doc(db, "usuarios", alumno.id);
      await updateDoc(alumnoRef, {
        bloqueado: !alumno.bloqueado
      });
      if (selectedAlumno?.id === alumno.id) {
        setSelectedAlumno({ ...alumno, bloqueado: !alumno.bloqueado });
      }
    } catch (error) {
      console.error("Error al cambiar estado de bloqueo:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f97316]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#0f1117] min-h-screen text-slate-200 font-sans">
      {/* HEADER ACTUALIZADO A EDUControlPro */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">
            EDU<span className="text-[#f97316]">ControlPro</span>
          </h1>
          <p className="text-[#f97316] text-[10px] font-bold uppercase tracking-widest mt-1">
            {institutoNombre} | AULA: {profesorAula} | PROFESOR: {professorId.substring(0,5)}
          </p>
        </div>
        <Badge className="bg-slate-800 text-slate-400 border-slate-700 px-4 py-1">
          {estudiantes.length} ALUMNOS ACTIVOS
        </Badge>
      </div>

      {/* GRID DE ALUMNOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {estudiantes.map((estudiante) => (
          <Card key={estudiante.id} className={`bg-slate-900 border-2 transition-all ${estudiante.bloqueado ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-slate-800 hover:border-[#f97316]'}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase">{estudiante.seccion}</span>
                <div className={`h-2.5 w-2.5 rounded-full ${estudiante.bloqueado ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'}`} />
              </div>
              <CardTitle className="text-sm font-black text-white uppercase mt-2">{estudiante.nombre}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button 
                onClick={() => setSelectedAlumno(estudiante)}
                className="w-full py-2.5 bg-slate-800 hover:bg-white hover:text-black text-white text-[10px] font-black uppercase italic rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Monitor size={14} />
                MONITOREAR
              </button>
              <button 
                onClick={() => toggleBloqueo(estudiante)}
                className={`w-full py-2.5 text-[10px] font-black uppercase italic rounded-xl transition-all flex items-center justify-center gap-2 border-2 ${estudiante.bloqueado ? 'bg-red-500 text-white border-red-500' : 'border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white'}`}
              >
                {estudiante.bloqueado ? <ShieldOff size={14} /> : <ShieldAlert size={14} />}
                {estudiante.bloqueado ? 'DESBLOQUEAR NAV.' : 'BLOQUEAR NAV.'}
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MODAL DE MONITOREO */}
      <Sheet open={!!selectedAlumno} onOpenChange={() => setSelectedAlumno(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#0f1117] border-slate-800 text-white p-0">
          <SheetHeader className="p-6 border-b border-slate-800 bg-slate-900/50">
            <SheetTitle className="text-[#f97316] font-black uppercase italic">VISTA EN VIVO</SheetTitle>
            <div className="mt-2">
              <p className="text-xl font-black uppercase">{selectedAlumno?.nombre}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">DEVICE: {selectedAlumno?.deviceId}</p>
            </div>
          </SheetHeader>

          <div className="p-6 space-y-6">
            <div className={`flex items-center gap-2 ${selectedAlumno?.bloqueado ? 'text-red-500' : 'text-green-500'}`}>
              <ShieldCheck size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {selectedAlumno?.bloqueado ? 'MODO RESTRICCIÓN ACTIVO' : 'NAVEGACIÓN SUPERVISADA'}
              </span>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <Clock size={12} /> HISTORIAL DE ACTIVIDAD
              </h3>
              
              <div className="space-y-3">
                {historial.length > 0 ? (
                  historial.map((log, i) => (
                    <div key={i} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-[#f97316]/10 rounded-lg">
                        <Globe size={16} className="text-[#f97316]" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[11px] font-black uppercase text-white truncate">{log.titulo || 'Sitio Web'}</p>
                        <p className="text-[9px] text-slate-500 font-bold truncate lowercase italic">{log.url}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center border-2 border-dashed border-slate-800 rounded-[2rem]">
                    <p className="text-[10px] font-black uppercase text-slate-600 tracking-tighter">SIN REGISTROS EN ESTA SESIÓN</p>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => selectedAlumno && toggleBloqueo(selectedAlumno)}
              className={`w-full py-4 text-[11px] font-black uppercase italic rounded-2xl transition-all border-2 ${selectedAlumno?.bloqueado ? 'bg-green-500 border-green-500 text-white' : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'}`}
            >
              {selectedAlumno?.bloqueado ? 'DESBLOQUEAR ACCESO' : 'BLOQUEAR ACCESO INMEDIATO'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}