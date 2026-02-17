'use client';

import { useState, useEffect, useMemo } from 'react';
import { useInstitution } from '@/app/(admin)/institution-context';
import { db, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs, CollectionReference, Query } from 'firebase/firestore';
import type { Classroom } from '@/lib/firestore-types';
import { Button } from '@/components/ui/button';
import { Building, Loader2, School } from 'lucide-react';
import { CreateClassroomDialog } from '@/components/admin/create-classroom-dialog';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardFooter } from '@/components/ui/card';
import React from 'react';

const StudentCount = ({ institutionId, classroomId }: { institutionId: string; classroomId: string }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            if (!db || !institutionId || !classroomId) return;
            const studentsRef = collection(db, 'institutions', institutionId, 'Aulas', classroomId, 'Alumnos');
            const snapshot = await getDocs(studentsRef);
            setCount(snapshot.size);
        };
        fetchCount();
    }, [institutionId, classroomId]);

    return (
        <span className="text-xs font-bold text-slate-400">{count} Alumnos Registrados</span>
    );
};

export default function ClassroomsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { institutionId } = useInstitution();
  const searchParams = useSearchParams();

  const classroomsRef = useMemo(() => {
    if (!db || !institutionId) {
        return query(collection(db, 'temp')); 
    }
    return query(
        collection(db, 'institutions', institutionId, 'Aulas'),
        orderBy('nombre_completo')
    );
  }, [institutionId]);

  const { value: classrooms, loading } = useCollection(classroomsRef);

  const createLink = (path: string) => {
    const params = new URLSearchParams(searchParams.toString());
    return `${path}?${params.toString()}`;
  }

  return (
    <>
      <CreateClassroomDialog 
        isOpen={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        institutionId={institutionId!} 
      />
      <div className="space-y-8">
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-black tracking-tighter italic leading-none">
                  <span className="text-slate-900">EFAS</span>{' '}
                  <span className="text-orange-500">ServiControlPro</span>
                </h1>
                <p className="text-slate-500 text-sm font-bold mt-1">
                  Servidor Web para Control Parental Multi-Usuarios
                </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-6 py-6 shadow-lg shadow-blue-200">
                + Nuevo Salon/Aula
            </Button>
        </header>

        {loading && (
            <div className="flex h-64 w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {!loading && classrooms.map((room) => (
                <Card key={room.id} className="rounded-2xl border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all group overflow-hidden bg-white">
                    <CardHeader className="pb-4">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-blue-50 transition-all">
                                <School className="w-6 h-6 text-slate-600 group-hover:text-blue-600" />
                            </div>
                             <span className={`text-[10px] font-black px-2 py-1 rounded tracking-widest ${room.status === 'published' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                {room.status === 'published' ? 'PUBLICADO' : 'BORRADOR'}
                             </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">{room.nombre_completo}</h3>
                        {room.capacidad && <p className="text-sm text-slate-400 font-bold mt-1 uppercase">Capacidad: {room.capacidad}</p>}
                    </CardHeader>
                    <CardFooter className="flex items-center justify-between pt-4 border-t border-slate-50 bg-slate-50/50">
                        <StudentCount institutionId={institutionId!} classroomId={room.id} />
                        <Button asChild variant="link" className="font-black text-xs p-0 h-auto text-blue-600 hover:text-blue-800 uppercase tracking-tighter">
                            <Link href={createLink(`/dashboard/classrooms/${room.id}`)}>
                                Gestionar &rarr;
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>

        {!loading && classrooms.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center h-full text-center p-12 border-4 border-dashed border-slate-100 rounded-3xl mt-12 bg-white">
                <Building className="h-20 w-20 mb-4 text-slate-200" />
                <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Sin salones/aulas configurados</h2>
                <p className="text-slate-400 font-medium max-w-xs mx-auto">Comienza creando tu primer salon/aula para asignar dispositivos y alumnos.</p>
            </div>
        )}
      </div>
    </>
  );
}
