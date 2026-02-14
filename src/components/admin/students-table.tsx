'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, User, Edit, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alumno } from '@/lib/firestore-types';
import { EditStudentModal } from './edit-student-modal';
import { Card } from '../ui/card';
import { InfractionLogModal } from './InfractionLogModal';

interface StudentsTableProps {
    institutionId: string;
    classroomId: string;
}

const getTodayInfractions = (student: Alumno) => {
    if (!student.logs_actividad) return 0;
    const today = new Date();
    // The date from firestore is a Timestamp object.
    return student.logs_actividad.filter(log => {
        if (!log.date) return false;
        const logDate = log.date.toDate();
        return logDate.getDate() === today.getDate() &&
               logDate.getMonth() === today.getMonth() &&
               logDate.getFullYear() === today.getFullYear();
    }).length;
}

export function StudentsTable({ institutionId, classroomId }: StudentsTableProps) {
    const [editingStudent, setEditingStudent] = useState<Alumno | null>(null);
    const [viewingLogsFor, setViewingLogsFor] = useState<Alumno | null>(null);
    const firestore = useFirestore();

    const studentsRef = useMemoFirebase(() => {
        if (!firestore || !institutionId || !classroomId) return null;
        return collection(firestore, 'institutions', institutionId, 'Aulas', classroomId, 'Alumnos');
    }, [firestore, institutionId, classroomId]);
    
    const { data: students, isLoading } = useCollection<Alumno>(studentsRef);

    return (
        <>
            <EditStudentModal
                isOpen={!!editingStudent}
                onOpenChange={(open) => !open && setEditingStudent(null)}
                student={editingStudent}
                institutionId={institutionId}
                classroomId={classroomId}
            />
            <InfractionLogModal
                isOpen={!!viewingLogsFor}
                onOpenChange={(open) => !open && setViewingLogsFor(null)}
                student={viewingLogsFor}
            />
            <Card>
                <Table>
                    <TableHeader className='bg-secondary'>
                        <TableRow>
                            <TableHead className="w-[100px] text-secondary-foreground">Nº EQUIPO</TableHead>
                            <TableHead className='text-secondary-foreground'>ALUMNO</TableHead>
                            <TableHead className='text-secondary-foreground'>SERIAL/MAC</TableHead>
                            <TableHead className="text-left text-secondary-foreground">INCIDENCIAS (HOY)</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && students?.map(student => {
                            const infractionsCount = getTodayInfractions(student);
                            return (
                                <TableRow key={student.id}>
                                    <TableCell className="font-mono font-bold">#{student.nro_equipo}</TableCell>
                                    <TableCell className="font-medium">{student.nombre_alumno}</TableCell>
                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                        {student.macAddress}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setViewingLogsFor(student)}
                                            className={`h-auto px-2 py-1 rounded-md font-bold text-xs ${
                                                infractionsCount > 0 
                                                ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' 
                                                : 'bg-slate-100 text-slate-500 cursor-default hover:bg-slate-100'
                                            }`}
                                            disabled={infractionsCount === 0}
                                        >
                                            {infractionsCount} Intento(s)
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingStudent(student)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Reasignar Alumno
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-50">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Eliminar Dispositivo
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
             {!isLoading && students?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-b-md">
                    <User className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No hay alumnos en esta aula</h3>
                    <p className="mt-1 text-sm">Inscribe el primer dispositivo desde la sección de Inscripción.</p>
                </div>
            )}
        </>
    )
}
