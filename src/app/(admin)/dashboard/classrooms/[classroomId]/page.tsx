'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useInstitution } from '@/app/(admin)/institution-context';
import { StudentsTable } from '@/components/admin/students-table';
import { useParams } from 'next/navigation';
// Importamos la base de datos de tu config, pero los hooks directamente de la librería
import { db } from '@/firebase'; 
import { useDocument } from 'react-firebase-hooks/firestore';
import { doc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import type { Classroom } from '@/lib/firestore-types';
import { Skeleton } from '@/components/ui/skeleton';
import EnrollmentQR from '@/components/admin/EnrollmentQR'; 
import { useToast } from '@/hooks/use-toast';
import AssignStudentModal from '@/components/admin/AssignStudentModal';

export default function ClassroomDetailPage() {
    const params = useParams();
    const classroomId = params.classroomId as string;
    const { institutionId } = useInstitution();
    const { toast } = useToast();

    const [pendingDevice, setPendingDevice] = useState<any>(null);
    const modalOpenRef = useRef(!!pendingDevice);

    useEffect(() => {
        modalOpenRef.current = !!pendingDevice;
    }, [pendingDevice]);

    const classroomRef = useMemo(() => {
        if (!db || !institutionId || !classroomId) return null;
        // Referencia a la subcolección Aulas usando InstitutoId (institutionId)
        return doc(db, 'institutions', institutionId, 'Aulas', classroomId);
    }, [institutionId, classroomId]);
    
    // Usamos el hook directamente
    const [value, loading] = useDocument(classroomRef);

    useEffect(() => {
        if (!db || !institutionId || !classroomId) return;

        const q = query(
            collection(db, 'pending_enrollments'),
            where('institutionId', '==', institutionId),
            where('classroomId', '==', classroomId),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' && !modalOpenRef.current) {
                    const data = change.doc.data();
                    setPendingDevice({ ...data, id: change.doc.id });
                    toast({
                        title: "Dispositivo detectado",
                        description: `Un nuevo dispositivo está listo para ser confirmado.`,
                    });
                }
            });
        });

        return () => unsubscribe();
    }, [institutionId, classroomId, toast]);

    return (
        <>
            {pendingDevice && (
              <AssignStudentModal 
                enrollmentId={pendingDevice.id}
                deviceId={pendingDevice.deviceInfo.macAddress}
                activeId={institutionId!}
                workingCondoId={classroomId} 
                onClose={() => setPendingDevice(null)}
              />
            )}
            <div className="space-y-8">
                <header className="flex justify-between items-center">
                    <div>
                        {loading ? (
                            <>
                                <Skeleton className="h-8 w-48 mb-2" />
                                <Skeleton className="h-4 w-72" />
                            </>
                        ) : (
                            <>
                                <h1 className="text-2xl font-black text-slate-800">
                                    {(value?.data() as Classroom)?.nombre_completo || 'Salon/Aula'}
                                </h1>
                                <p className="text-slate-500 text-sm">Gestiona los alumnos y dispositivos de este salon/aula.</p>
                            </>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-2">
                        <StudentsTable institutionId={institutionId!} classroomId={classroomId} />
                    </div>

                    <div className="xl:col-span-1">
                        {institutionId && classroomId && (
                            <EnrollmentQR 
                                activeId={institutionId} 
                                workingCondoId={classroomId} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
