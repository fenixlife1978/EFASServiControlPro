'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Users, Search, Lock, Unlock, GraduationCap, AlertTriangle, Building2, Layers } from 'lucide-react';

interface ProfesorViewProps {
  professorId: string;
  institutoId: string;
}

export const ProfesorView = ({ professorId, institutoId }: ProfesorViewProps) => {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profData, setProfData] = useState<any>(null);
  const [instName, setInstName] = useState('...');
  const [aulaName, setAulaName] = useState('...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!institutoId || !professorId) return;
    
    let unsubStudents: (() => void) | null = null;
    let unsubAula: (() => void) | null = null;

    const initializeView = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Buscar al profesor validando InstitutoId y role (como los directores)
        // Usamos el ID del documento para ir directo, pero validamos sus campos
        const profRef = doc(db, "usuarios", professorId);
        const profSnap = await getDoc(profRef);
        
        if (!profSnap.exists()) {
          setError("Usuario no encontrado");
          setLoading(false);
          return;
        }

        const pData = profSnap.data();

        // Validación de seguridad: debe pertenecer al instituto y ser profesor
        if (pData.InstitutoId !== institutoId || pData.role !== 'profesor') {
          console.error("Acceso denegado: El usuario no es profesor de este instituto");
          setError("Acceso no autorizado a esta sede");
          setLoading(false);
          return;
        }

        setProfData(pData);

        // 2. Obtener Nombre de la Institución (Sede)
        const instSnap = await getDoc(doc(db, "institutions", institutoId));
        if (instSnap.exists()) {
          setInstName(instSnap.data().nombre || "Sede EFAS");
        }

        // 3. Buscar Aula y Estudiantes si tiene sección asignada
        if (pData.seccion) {
          // Obtener nombre del Aula desde subcolección Aulas
          const aulasRef = collection(db, "institutions", institutoId, "Aulas");
          const qAula = query(aulasRef, where("seccion", "==", pData.seccion));
          
          unsubAula = onSnapshot(qAula, (snap) => {
            if (!snap.empty) {
              setAulaName(snap.docs[0].data().nombre_completo || snap.docs[0].data().nombre);
            } else {
              setAulaName("AULA: " + pData.seccion);
            }
          });

          // Escuchar Estudiantes de la misma sección e InstitutoId
          const qStudents = query(
            collection(db, "usuarios"), 
            where("InstitutoId", "==", institutoId),
            where("role", "==", "estudiante"),
            where("seccion", "==", pData.seccion)
          );

          unsubStudents = onSnapshot(qStudents, (snapshot) => {
            setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
          });
        } else {
          setLoading(false);
        }

      } catch (err: any) {
        console.error("Error en ProfesorView:", err);
        setError("Error de conexión con la base de datos");
        setLoading(false);
      }
    };

    initializeView();

    return () => {
      if (unsubAula) unsubAula();
      if (unsubStudents) unsubStudents();
    };
  }, [institutoId, professorId]);

  const toggleBlindaje = async (studentId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "usuarios", studentId), {
        blindajeTotal: !currentStatus,
        lastSecurityAction: serverTimestamp(),
        actionBy: professorId
      });
    } catch (e) {
      console.error("Error toggling blindaje:", e);
    }
  };

  const filteredStudents = students.filter(s => 
    (s.nombre || s.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex h-64 flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500"></div>
      <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Cargando Sede...</p>
    </div>
  );

  if (error) return (
    <div className="p-10 bg-red-500/5 border border-red-500/20 rounded-[3rem] text-center">
      <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
      <h3 className="text-white font-black uppercase italic text-lg">Error de Validación</h3>
      <p className="text-slate-400 text-xs mt-2 font-bold uppercase">{error}</p>
    </div>
  );

  return (
    <div className="space-y-6 p-2">
      {/* Header Info Panel */}
      <div className="bg-[#0f1117] p-8 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <GraduationCap size={120} />
        </div>
        
        <div className="flex flex-col lg:flex-row justify-between items-center gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-orange-500/10 rounded-[2rem] border border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
              <GraduationCap className="text-orange-500" size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase italic leading-none tracking-tighter">EFAS ServiControlPro</h2>
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full">
                  <Building2 size={12} className="text-orange-500"/>
                  <span className="text-[10px] font-black text-slate-300 uppercase italic">{instName}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full">
                  <Layers size={12} className="text-blue-500"/>
                  <span className="text-[10px] font-black text-slate-300 uppercase italic">{aulaName}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
                  <span className="text-[10px] font-black text-orange-500 uppercase italic">SECCIÓN: {profData?.seccion || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="BUSCAR ESTUDIANTE..."
              className="w-full bg-black/40 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-[11px] font-bold text-white uppercase outline-none focus:border-orange-500 transition-all placeholder:text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Lista de Alumnos */}
      {!profData?.seccion ? (
        <div className="py-24 text-center bg-[#0f1117] rounded-[3rem] border border-dashed border-slate-800">
          <AlertTriangle className="mx-auto text-orange-500/50 mb-4" size={50} />
          <p className="text-slate-400 font-black uppercase italic text-sm">El perfil del profesor no tiene una sección vinculada.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="py-24 text-center bg-[#0f1117] rounded-[3rem] border border-dashed border-slate-800">
          <Users className="mx-auto text-slate-800 mb-4" size={50} />
          <p className="text-slate-600 font-black uppercase italic text-sm tracking-widest">Esperando conexión de estudiantes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStudents.map((student) => (
            <div key={student.id} className={`p-6 rounded-[2.5rem] border transition-all duration-500 group ${student.blindajeTotal ? 'bg-red-500/5 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'bg-[#0f1117] border-slate-800 hover:border-slate-700 shadow-xl'}`}>
              <div className="flex items-center gap-4 mb-8">
                <div className={`p-4 rounded-[1.5rem] transition-all duration-500 ${student.blindajeTotal ? 'bg-red-500/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                  <Users className={student.blindajeTotal ? 'text-red-500' : 'text-slate-500'} size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-white uppercase truncate tracking-tight">{student.nombre || 'Estudiante'}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase italic mt-1">Tablet: {student.tabletId || 'No vinculada'}</p>
                </div>
              </div>
              
              <button 
                onClick={() => toggleBlindaje(student.id, student.blindajeTotal)}
                className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase italic transition-all active:scale-95 ${
                  student.blindajeTotal 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' 
                  : 'bg-white text-black hover:bg-orange-500 hover:text-white'
                }`}
              >
                {student.blindajeTotal ? (
                  <span className="flex items-center justify-center gap-2"><Lock size={14} strokeWidth={3}/> Blindado</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><Unlock size={14} strokeWidth={3}/> Desbloqueado</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
