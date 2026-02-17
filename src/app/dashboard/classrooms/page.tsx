'use client';
import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { InstitutionProvider, useInstitution } from '@/app/(admin)/institution-context';

// Interfaz para los datos de tu aula
interface Classroom {
  id: string;
  nombre: string;
  seccion: string;
  capacidad: number;
  estado: 'activa' | 'mantenimiento';
}

function ClassroomsList() {
  const { institutionId } = useInstitution(); // Usando InstitutoId según instrucciones
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!institutionId) return;

    // Consulta filtrada por InstitutoId para evitar mezcla de datos
    const q = query(
      collection(db, 'classrooms'),
      where('InstitutoId', '==', institutionId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Classroom[];
      setClassrooms(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId]);

  return (
    <div className="p-6 md:p-10 bg-slate-50 min-h-screen">
      {/* Header Estilo EFAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase text-slate-900 tracking-tighter">
            Control de <span className="text-orange-500">Aulas</span>
          </h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-widest mt-1">
            EFAS ServControlPro • ID: {institutionId || '---'}
          </p>
        </div>
        
        <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-2xl transition-all shadow-lg shadow-orange-200 uppercase text-sm italic">
          + Nueva Aula
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-orange-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((aula) => (
            <div key={aula.id} className="bg-white border-2 border-slate-100 p-1 rounded-[2.5rem] shadow-xl hover:border-orange-200 transition-all group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-slate-100 w-14 h-14 rounded-3xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <span className="text-2xl">🏫</span>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase italic ${
                    aula.estado === 'activa' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {aula.estado || 'Activa'}
                  </span>
                </div>

                <h3 className="text-xl font-black text-slate-800 uppercase italic leading-none mb-1">
                  {aula.nombre}
                </h3>
                <p className="text-slate-400 font-bold text-sm mb-6">Sección: {aula.seccion || 'N/A'}</p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                   <div>
                      <p className="text-[10px] text-slate-400 uppercase font-black">Capacidad</p>
                      <p className="text-lg font-black text-slate-700">{aula.capacidad || 0} <span className="text-xs text-slate-400">Puestos</span></p>
                   </div>
                   
                   <Link 
                    href={`/dashboard/classrooms/${aula.id}`}
                    className="bg-slate-900 hover:bg-orange-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md"
                   >
                     →
                   </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {classrooms.length === 0 && !loading && (
        <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-bold italic uppercase">No hay aulas registradas para este instituto</p>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 font-black italic text-slate-400">CARGANDO SISTEMA...</div>}>
      <InstitutionProvider>
        <ClassroomsList />
      </InstitutionProvider>
    </Suspense>
  );
}