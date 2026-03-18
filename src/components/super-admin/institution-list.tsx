'use client';
import React from 'react';
import { db, rtdb } from '@/firebase/config'; // Importamos rtdb para la limpieza
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, remove } from 'firebase/database'; // Funciones para borrar en RTDB
import { Trash2, Building2, ArrowRight } from 'lucide-react';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';

export default function InstitutionList() {
  const [institutions, setInstitutions] = React.useState<any[]>([]);
  const { setInstitutionId } = useInstitution();

  React.useEffect(() => {
    // Escuchamos las sedes de EDUControlPro en tiempo real
    return onSnapshot(collection(db, "institutions"), (s) => {
      setInstitutions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string, nombre: string) => {
    e.stopPropagation();
    
    const confirmDelete = confirm(
      `⚠️ ACCIÓN DE ALTO RIESGO ⚠️\n\n` +
      `¿Estás seguro de eliminar la sede "${nombre.toUpperCase()}"?\n\n` +
      `Esto borrará los registros administrativos (Firestore) y los nodos de control táctico (Realtime DB).`
    );
    
    if (confirmDelete) {
      try {
        // 1. ELIMINACIÓN EN REALTIME DATABASE
        // Borramos el nodo de control antes que el registro maestro
        const instControlRef = ref(rtdb, `control_sedes/${id}`);
        await remove(instControlRef);

        // 2. ELIMINACIÓN EN FIRESTORE
        await deleteDoc(doc(db, "institutions", id));
        
        alert("✅ Sede y nodos de control eliminados correctamente.");
      } catch (error) {
        console.error("Error en la eliminación híbrida:", error);
        alert("Error crítico: No se pudo completar la eliminación total.");
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {institutions.length === 0 ? (
        <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-[3rem]">
          <p className="text-slate-600 font-black uppercase italic text-[10px] tracking-[0.3em]">
            No hay sedes registradas en EDUControlPro
          </p>
        </div>
      ) : (
        institutions.map((inst) => (
          <div 
            key={inst.id} 
            className="bg-[#0f1117] p-8 rounded-[2.5rem] border border-slate-800 hover:border-orange-500/50 transition-all group relative overflow-hidden"
          >
            {/* Decoración de fondo */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-[40px] -z-10 group-hover:bg-orange-500/10 transition-colors" />

            <div className="flex justify-between items-start mb-6">
              <div className="bg-slate-900 p-4 rounded-2xl text-orange-500 border border-slate-800 group-hover:border-orange-500/30 transition-all">
                <Building2 size={24} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[8px] font-black text-slate-500 uppercase italic tracking-tighter">Sede Activa</span>
              </div>
            </div>

            <h3 className="text-2xl font-black italic uppercase text-white mb-2 leading-none truncate pr-10 tracking-tighter">
              {inst.nombre || 'Sin Nombre'}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
              <span className="opacity-50">Access Key:</span> 
              <span className="text-orange-500 font-black">{inst.InstitutoId || inst.id}</span>
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setInstitutionId(inst.id)}
                className="flex-1 bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase italic flex items-center justify-center gap-2 hover:bg-orange-500 hover:text-white transition-all shadow-xl active:scale-95"
              >
                Gestionar Sede <ArrowRight size={14} />
              </button>
              
              <button 
                onClick={(e) => handleDelete(e, inst.id, inst.nombre)}
                className="p-4 bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-500 hover:border-red-500/50 rounded-xl transition-all active:scale-90"
                title="Eliminar Sede Permanentemente"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
