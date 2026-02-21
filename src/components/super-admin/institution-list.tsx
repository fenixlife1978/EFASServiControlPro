'use client';
import React from 'react';
import { db } from '@/firebase/config';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, Building2, ArrowRight } from 'lucide-react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';

export default function InstitutionList() {
  const [institutions, setInstitutions] = React.useState<any[]>([]);
  const { setInstitutionId } = useInstitution();

  React.useEffect(() => {
    return onSnapshot(collection(db, "institutions"), (s) => {
      setInstitutions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string, nombre: string) => {
    e.stopPropagation(); // Evita que se dispare el evento de 'Gestionar'
    const confirmDelete = confirm(`⚠️ ACCIÓN CRÍTICA ⚠️\n\n¿Estás seguro de eliminar la sede "${nombre.toUpperCase()}"?\nEsta acción borrará el registro de la institución permanentemente.`);
    
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "institutions", id));
        alert("✅ Sede eliminada correctamente.");
      } catch (error) {
        console.error("Error al eliminar:", error);
        alert("No se pudo eliminar la sede.");
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {institutions.map((inst) => (
        <div key={inst.id} className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500/50 transition-all group relative">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-slate-900 p-4 rounded-2xl text-orange-500">
              <Building2 size={24} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[8px] font-black text-slate-500 uppercase italic">Online</span>
            </div>
          </div>

          <h3 className="text-2xl font-black italic uppercase text-white mb-2 leading-none truncate pr-10">
            {inst.nombre || 'Sin Nombre'}
          </h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8">
            Access Key: <span className="text-orange-500/80">{inst.InstitutoId || inst.id}</span>
          </p>

          <div className="flex gap-3">
            <button 
              onClick={() => setInstitutionId(inst.id)}
              className="flex-1 bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase italic flex items-center justify-center gap-2 hover:bg-orange-500 hover:text-white transition-all"
            >
              Gestionar <ArrowRight size={14} />
            </button>
            
            {/* BOTÓN DE ELIMINAR SEÑALADO EN TU IMAGEN */}
            <button 
              onClick={(e) => handleDelete(e, inst.id, inst.nombre)}
              className="p-4 bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-500 hover:border-red-500/50 rounded-xl transition-all"
              title="Eliminar Sede"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
