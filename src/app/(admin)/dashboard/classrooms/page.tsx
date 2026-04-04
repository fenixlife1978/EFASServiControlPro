'use client';
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, serverTimestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit3, Trash2, DoorOpen, Layout } from 'lucide-react';

export default function GestionAulas() {
  const { institutionId } = useInstitution();
  const [aulas, setAulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAula, setNewAula] = useState({ aulaId: '', seccion: '', grado: '' });

  useEffect(() => {
    if (!institutionId) return;
    const unsub = onSnapshot(collection(db, `institutions/${institutionId}/Aulas`), (snaps) => {
      setAulas(snaps.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [institutionId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.aulaId || !institutionId) return;
    
    try {
      const path = `institutions/${institutionId}/Aulas`;
      const customId = newAula.aulaId.toUpperCase().trim().replace(/\s+/g, '_');
      const data = {
        aulaId: customId,
        seccion: newAula.seccion.toUpperCase().trim(),
        grado: newAula.grado.toUpperCase().trim(),
        nombre_completo: `${newAula.grado} - ${newAula.seccion}`,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, path, editingId), data);
      } else {
        await setDoc(doc(db, path, customId), { ...data, status: 'published', createdAt: serverTimestamp(), institutionId });
      }
      handleCloseModal();
    } catch (e) { console.error(e); }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewAula({ aulaId: '', seccion: '', grado: '' });
    setEditingId(null);
  };

  const handleEdit = (aula: any) => {
    setNewAula({ aulaId: aula.aulaId, seccion: aula.seccion, grado: aula.grado });
    setEditingId(aula.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿ELIMINAR ESTA AULA?")) {
      await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, id));
    }
  };

  return (
    <div className="p-8 bg-[#0a0c10] min-h-screen text-white">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Control de <span className="text-orange-500">Aulas</span></h1>
        <button onClick={() => setShowModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-lg transition-all">
          + Nueva Aula
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {aulas.map((aula) => (
          <div key={aula.id} className="bg-[#0f1117] p-8 rounded-[3rem] border border-white/5 relative group hover:border-orange-500/50 transition-all">
            <div className="absolute top-6 right-6 flex gap-2">
              <button onClick={() => handleEdit(aula)} className="p-2 bg-slate-900 rounded-lg text-slate-500 hover:text-orange-500 transition-colors"><Edit3 size={16}/></button>
              <button onClick={() => handleDelete(aula.id)} className="p-2 bg-slate-900 rounded-lg text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
            </div>
            <h3 className="text-2xl font-black italic uppercase mb-2">{aula.aulaId}</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Sección {aula.seccion} • {aula.grado}</p>
            <Link href={`/dashboard/classrooms/view?id=${aula.id}`} className="block w-full text-center bg-white text-black py-4 rounded-xl font-black uppercase text-[10px] hover:bg-orange-500 hover:text-white transition-all">Ver Unidades</Link>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-[#0f1117] border border-slate-800 p-10 rounded-[3rem] w-full max-w-md space-y-4">
            <h2 className="text-2xl font-black italic uppercase text-white mb-6">{editingId ? 'Editar' : 'Nueva'} Aula</h2>
            <input required className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase" placeholder="ID AULA (EJ: 6TO_GRADO)" value={newAula.aulaId} onChange={e => setNewAula({...newAula, aulaId: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <input required className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase" placeholder="SECCIÓN" value={newAula.seccion} onChange={e => setNewAula({...newAula, seccion: e.target.value})} />
              <input required className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase" placeholder="GRADO" value={newAula.grado} onChange={e => setNewAula({...newAula, grado: e.target.value})} />
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={handleCloseModal} className="flex-1 text-slate-500 font-black uppercase text-[10px]">Cancelar</button>
              <button type="submit" className="flex-2 bg-orange-500 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px]">Guardar Aula</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
