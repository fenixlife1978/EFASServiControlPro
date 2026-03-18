'use client';
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, serverTimestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useInstitution } from '../institution-context';
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
  const router = useRouter();

  useEffect(() => {
    if (!institutionId) return;
    const path = `institutions/${institutionId}/Aulas`;
    const colRef = collection(db, path);
    const unsub = onSnapshot(colRef, (snaps) => {
      const lista = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      setAulas(lista);
      setLoading(false);
    });
    return () => unsub();
  }, [institutionId]);

  const handleEdit = (aula: any) => {
    setNewAula({
      aulaId: aula.aulaId || aula.id,
      seccion: aula.seccion || '',
      grado: aula.grado || ''
    });
    setEditingId(aula.id);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAula.aulaId || !institutionId) return;
    
    try {
      const path = `institutions/${institutionId}/Aulas`;
      const customId = newAula.aulaId.toUpperCase().trim().replace(/\s+/g, '_');
      
      if (editingId) {
        // Si estamos editando
        await updateDoc(doc(db, path, editingId), {
          aulaId: customId,
          seccion: newAula.seccion.toUpperCase().trim(),
          grado: newAula.grado.toUpperCase().trim(),
          nombre_completo: `${newAula.grado} - ${newAula.seccion}`,
          updatedAt: serverTimestamp()
        });
      } else {
        // Si es nueva, usamos el ID personalizado para consistencia
        await setDoc(doc(db, path, customId), {
          aulaId: customId,
          seccion: newAula.seccion.toUpperCase().trim(),
          grado: newAula.grado.toUpperCase().trim(),
          nombre_completo: `${newAula.grado} - ${newAula.seccion}`,
          status: 'published',
          createdAt: serverTimestamp(),
          InstitutoId: institutionId
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error al procesar aula:", error);
      alert("Error al guardar el aula. Verifique su conexión.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desea eliminar este salón de clases definitivamente? Esta acción no se puede deshacer.")) return;
    try {
      await deleteDoc(doc(db, `institutions/${institutionId}/Aulas`, id));
    } catch (error) {
      console.error("Error al eliminar aula:", error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewAula({ aulaId: '', seccion: '', grado: '' });
    setEditingId(null);
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-start mb-12">
        <header>
          <h1 className="text-5xl font-black italic uppercase text-slate-900 tracking-tighter">
            Control de <span className="text-orange-500">Aulas</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-3 italic">
            EDU ServControlPro • {institutionId || 'Sin Sede'}
          </p>
        </header>

        <button 
          onClick={() => {
            setEditingId(null);
            setNewAula({ aulaId: '', seccion: '', grado: '' });
            setShowModal(true);
          }}
          className="bg-orange-500 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase italic text-xs transition-all shadow-lg shadow-orange-200 flex items-center gap-2"
        >
          <DoorOpen size={16} /> + Nueva Aula
        </button>
      </div>

      {loading ? (
        <div className="font-black italic text-slate-300 uppercase animate-pulse">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {aulas.map((aula) => (
            <div key={aula.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm hover:border-orange-500 transition-all group relative overflow-hidden">
              {/* BOTONES DE ACCIÓN SIEMPRE VISIBLES */}
              <div className="absolute top-6 right-6 flex gap-2 z-10">
                <button 
                  onClick={() => handleEdit(aula)}
                  className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-orange-500 hover:text-white transition-colors shadow-sm"
                  title="Editar Aula"
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(aula.id)}
                  className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                  title="Eliminar Aula"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full mb-4 inline-block italic">
                {aula.status || 'Publicado'}
              </span>
              
              <h3 className="text-2xl font-black italic uppercase text-slate-800 leading-tight mb-2 pr-20">
                {aula.aulaId || aula.id}
              </h3>
              
              <p className="text-slate-400 font-bold uppercase text-[10px] mb-6 italic">
                Sección: {aula.seccion} • Grado: {aula.grado}
              </p>

              <Link href={`/dashboard/classrooms/view?id=${aula.id}`} className="inline-flex items-center justify-center w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase italic text-xs hover:bg-orange-500 transition-colors">
                Ver Dispositivos →
              </Link>
            </div>
          ))}
          
          {aulas.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-200 rounded-[4rem]">
              <Layout className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="font-black italic text-slate-300 uppercase">No hay aulas registradas en esta sede</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl border border-slate-100">
            <h2 className="text-3xl font-black italic uppercase mb-6 text-slate-900">
              {editingId ? 'Editar' : 'Registrar'} <span className="text-orange-500">Aula</span>
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Identificador (ID)</label>
                <input 
                  placeholder="EJ: 6TO_GRADO"
                  required
                  className="w-full p-4 bg-slate-50 rounded-xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm text-slate-900 uppercase"
                  value={newAula.aulaId}
                  onChange={e => setNewAula({...newAula, aulaId: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Sección</label>
                  <input 
                    placeholder="EJ: A"
                    required
                    className="w-full p-4 bg-slate-50 rounded-xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm text-slate-900 uppercase"
                    value={newAula.seccion}
                    onChange={e => setNewAula({...newAula, seccion: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Grado</label>
                  <input 
                    placeholder="EJ: PRIMARIA"
                    required
                    className="w-full p-4 bg-slate-50 rounded-xl border-2 border-transparent focus:border-orange-500 outline-none font-bold text-sm text-slate-900 uppercase"
                    value={newAula.grado}
                    onChange={e => setNewAula({...newAula, grado: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={handleCloseModal} className="flex-1 font-black uppercase italic text-xs text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-900 hover:bg-orange-500 text-white p-4 rounded-xl font-black uppercase italic text-xs transition-all shadow-lg">
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
