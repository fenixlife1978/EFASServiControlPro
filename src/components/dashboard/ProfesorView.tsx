'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Users, Search, Lock, Unlock, GraduationCap } from 'lucide-react';

interface ProfesorViewProps {
  professorId: string;
  institutoId: string;
}

export const ProfesorView = ({ professorId, institutoId }: ProfesorViewProps) => {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!institutoId) return;
    
    // CORRECCIÓN: Usamos tu colección "usuarios" y el rol "estudiante"
    const q = query(
      collection(db, "usuarios"), 
      where("InstitutoId", "==", institutoId),
      where("role", "==", "estudiante")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentData);
    });

    return () => unsubscribe();
  }, [institutoId]);

  const toggleBlindaje = async (studentId: string, currentStatus: boolean) => {
    try {
      // CORRECCIÓN: Actualizamos en la colección "usuarios"
      await updateDoc(doc(db, "usuarios", studentId), {
        blindajeTotal: !currentStatus,
        lastSecurityAction: serverTimestamp(),
        actionBy: professorId
      });
    } catch (e) {
      console.error("Error al activar blindaje:", e);
    }
  };

  const filteredStudents = students.filter(s => 
    (s.nombre || s.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 p-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="text-orange-500" size={24} />
          <h2 className="text-2xl font-black text-white uppercase italic">Control de Aula</h2>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="BUSCAR ESTUDIANTE..."
            className="w-full bg-[#0f1117] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white uppercase outline-none focus:border-orange-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredStudents.map((student) => (
          <div key={student.id} className={`p-6 rounded-[2rem] border ${student.blindajeTotal ? 'bg-red-500/10 border-red-500/50' : 'bg-[#0f1117] border-slate-800'}`}>
            <div className="flex items-center gap-3 mb-4">
              <Users className={student.blindajeTotal ? 'text-red-500' : 'text-slate-400'} size={20} />
              <div className="truncate">
                <p className="text-[10px] font-black text-white uppercase truncate">{student.nombre || student.displayName || 'Sin nombre'}</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase italic">{student.tabletId || 'Sin Tablet'}</p>
              </div>
            </div>
            <button 
              onClick={() => toggleBlindaje(student.id, student.blindajeTotal)}
              className={`w-full py-3 rounded-xl font-black text-[9px] uppercase italic transition-all ${
                student.blindajeTotal ? 'bg-red-500 text-white' : 'bg-white text-black hover:bg-orange-500 hover:text-white'
              }`}
            >
              {student.blindajeTotal ? <span className="flex items-center justify-center gap-2"><Lock size={12}/> Blindaje Activo</span> : <span className="flex items-center justify-center gap-2"><Unlock size={12}/> Activar Blindaje</span>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
