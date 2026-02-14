'use client';
import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Alumno } from '@/lib/firestore-types';

interface Props {
  enrollmentId: string;    // ID del doc en pending_enrollments
  deviceId: string;        // ID del hardware de la tablet
  activeId: string;        // ID Institución
  workingCondoId: string;  // ID Aula
  onClose: () => void;
}

export default function AssignStudentModal({ enrollmentId, deviceId, activeId, workingCondoId, onClose }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    setLoading(true);

    try {
      const alumnosRef = collection(firestore, 'institutions', activeId, 'Aulas', workingCondoId, 'Alumnos');
      const snapshot = await getDocs(alumnosRef);
      const nextNumber = (snapshot.size + 1).toString().padStart(2, '0');

      // Asumimos que deviceId es la MAC y se usa como ID de documento para el alumno
      const newAlumnoRef = doc(alumnosRef, deviceId);
      const pendingDocRef = doc(firestore, 'pending_enrollments', enrollmentId);
      
      const newAlumnoData: Partial<Alumno> = {
        nro_equipo: nextNumber,
        nombre_alumno: name,
        macAddress: deviceId, // Asignamos el deviceId a macAddress
        institutionId: activeId,
        classroomId: workingCondoId,
        // 'modelo' no está disponible en este modal, se podría añadir si es necesario
      };
      
      const batch = writeBatch(firestore);
      batch.set(newAlumnoRef, newAlumnoData, { merge: true }); // Usamos merge por si el doc ya existe
      batch.delete(pendingDocRef);

      await batch.commit();
      
      toast({ title: 'Éxito', description: 'El alumno ha sido asignado al dispositivo.' });
      onClose();
    } catch (error) {
      console.error("Error al asignar alumno:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la asignación.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-blue-100">
        <div className="text-center mb-6">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Vincular Estudiante</h2>
          <p className="text-slate-500 text-sm font-medium">Se ha detectado un nuevo dispositivo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre y Apellido del Alumno</label>
            <input 
              autoFocus
              required
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-700"
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">ID Hardware Detectado</p>
            <p className="text-xs font-mono font-bold text-blue-700">{deviceId}</p>
          </div>

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-200 transition-all disabled:opacity-50"
          >
            {loading ? 'REGISTRANDO...' : 'FINALIZAR REGISTRO'}
          </button>
        </form>
      </div>
    </div>
  );
}
