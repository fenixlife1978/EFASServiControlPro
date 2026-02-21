'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Users, Search, Lock, Unlock, GraduationCap, AlertTriangle } from 'lucide-react';

interface ProfesorViewProps {
  professorId: string;
  institutoId: string;
}

export const ProfesorView = ({ professorId, institutoId }: ProfesorViewProps) => {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profData, setProfData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!institutoId || !professorId) return;
    
    const initializeProfesor = async () => {
      setLoading(true);
      try {
        // 1. Obtener datos del profesor para saber su "seccion"
        const profRef = doc(db, "usuarios", professorId);
        const profSnap = await getDoc(profRef);
        
        if (profSnap.exists()) {
          const data = profSnap.data();
          setProfData(data);
          
          if (data.seccion) {
            // 2. Escuchar estudiantes filtrados por InstitutoId, rol y la seccion del profesor
            const q = query(
              collection(db, "usuarios"), 
              where("InstitutoId", "==", institutoId),
              where("role", "==", "estudiante"),
              where("seccion", "==", data.seccion)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
              const studentData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));
              setStudents(studentData);
              setLoading(false);
            });

            return unsubscribe;
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error inicializando vista de profesor:", error);
        setLoading(false);
      }
    };

    const unsubPromise = initializeProfesor();
    return () => {
      unsubPromise.then(unsub => unsub && (unsub as () => void)());
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
      console.error("Error al actualizar blindaje:", e);
    }
  };

  const filteredStudents = students.filter(s => 
    (s.nombre || s.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
    </div>
  );

  return (
    <div className="space-y-8 p-4">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0f1117] p-6 rounded-[2rem] border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-2xl">
            <GraduationCap className="text-orange-500" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic leading-none">Panel de Aula</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              INSTITUTO: <span className="text-white">{institutoId}</span> | 
               SECCIÓN: <span className="text-orange-500">{profData?.seccion || 'NO ASIGNADA'}</span>
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="BUSCAR ESTUDIANTE..."
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-xs text-white uppercase outline-none focus:border-orange-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {!profData?.seccion ? (
        <div className="flex flex-col items-center justify-center py-20 bg-red-500/5 rounded-[3rem] border border-dashed border-red-500/20">
           <AlertTriangle className="text-red-500 mb-4" size={48} />
           <p className="text-red-500 font-black uppercase italic text-xs text-center">
             Atención: No tienes una SECCIÓN asignada.<br/>
             <span className="text-slate-500 text-[10px]">Contacta al Super Admin para vincular tu cuenta a un aula.</span>
           </p>
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#0f1117]/50 rounded-[3rem] border border-dashed border-slate-800">
           <Users className="text-slate-700 mb-4" size={48} />
           <p className="text-slate-500 font-black uppercase italic text-xs">No hay estudiantes en la sección {profData.seccion}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredStudents.map((student) => (
            <div key={student.id} className={`p-6 rounded-[2.5rem] border transition-all duration-300 ${student.blindajeTotal ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-[#0f1117] border-slate-800'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl ${student.blindajeTotal ? 'bg-red-500/20' : 'bg-slate-800/50'}`}>
                  <Users className={student.blindajeTotal ? 'text-red-500' : 'text-slate-400'} size={20} />
                </div>
                <div className="truncate">
                  <p className="text-[11px] font-black text-white uppercase truncate">{student.nombre || student.displayName || 'Estudiante'}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase italic tracking-tighter">ID: {student.tabletId || 'N/A'}</p>
                </div>
              </div>
              <button 
                onClick={() => toggleBlindaje(student.id, student.blindajeTotal)}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase italic transition-all active:scale-95 ${
                  student.blindajeTotal 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white text-black hover:bg-orange-500 hover:text-white'
                }`}
              >
                {student.blindajeTotal ? (
                  <span className="flex items-center justify-center gap-2"><Lock size={14}/> Blindaje Activo</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><Unlock size={14}/> Activar Blindaje</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
