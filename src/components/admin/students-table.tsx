'use client';

import { useState, useMemo, useEffect } from 'react';
import { dbService } from '@/lib/dbService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, User, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '../ui/card';
import { InfractionLogModal } from './InfractionLogModal';

interface StudentsTableProps {
    institutionId: string;
    classroomId: string;
    seccion?: string;
}

interface Alumno {
    id: string;
    nombre_alumno: string;
    nombre?: string;
    nro_equipo?: string;
    deviceId?: string;
    macAddress?: string;
    // Otros campos...
}

export function StudentsTable({ institutionId, classroomId, seccion }: StudentsTableProps) {
    const [students, setStudents] = useState<Alumno[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingStudent, setEditingStudent] = useState<Alumno | null>(null);
    const [viewingLogsFor, setViewingLogsFor] = useState<{ deviceId: string; alumnoNombre: string } | null>(null);
    const [infraccionesHoy, setInfraccionesHoy] = useState<Map<string, number>>(new Map());

    // Cargar alumnos desde la colección "usuarios"
    useEffect(() => {
        if (!institutionId || !classroomId) return;

        const cargarAlumnos = async () => {
            setLoading(true);
            try {
                // Buscar en colección "usuarios" donde:
                // - InstitutoId = institutionId
                // - aulaId = classroomId
                // - rol = "alumno"
                const q = query(
                    collection(db, "usuarios"),
                    where("InstitutoId", "==", institutionId),
                    where("aulaId", "==", classroomId),
                    where("rol", "==", "alumno")
                );
                
                const snapshot = await getDocs(q);
                const alumnosData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        nombre_alumno: data.nombre || data.alumno_asignado || 'Sin nombre',
                        nombre: data.nombre || data.alumno_asignado,
                        nro_equipo: data.nro_equipo || 'N/A',
                        deviceId: data.deviceId || doc.id,
                        macAddress: data.macAddress || 'N/A',
                        ...data
                    };
                });
                
                setStudents(alumnosData);
                
                // Cargar infracciones de hoy para cada alumno
                await cargarInfraccionesHoy(alumnosData);
                
            } catch (error) {
                console.error("Error cargando alumnos:", error);
            } finally {
                setLoading(false);
            }
        };

        cargarAlumnos();
    }, [institutionId, classroomId]);

    // Cargar infracciones de hoy para todos los alumnos
    const cargarInfraccionesHoy = async (alumnos: Alumno[]) => {
        const mapa = new Map<string, number>();
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        for (const alumno of alumnos) {
            const deviceId = alumno.deviceId || alumno.id;
            if (!deviceId) continue;
            
            try {
                // Buscar en incidencias de hoy
                const q = query(
                    collection(db, "dispositivos", deviceId, "incidencias"),
                    where("timestamp", ">=", hoy)
                );
                const snapshot = await getDocs(q);
                mapa.set(deviceId, snapshot.size);
            } catch (error) {
                console.error(`Error cargando incidencias para ${deviceId}:`, error);
                mapa.set(deviceId, 0);
            }
        }
        
        setInfraccionesHoy(mapa);
    };

    return (
        <>
            {/* EditStudentModal comentado hasta tener el archivo */}
            {/* <EditStudentModal
                isOpen={!!editingStudent}
                onOpenChange={(open: boolean) => !open && setEditingStudent(null)}
                student={editingStudent}
                institutionId={institutionId}
                classroomId={classroomId}
            /> */}
            <InfractionLogModal
                isOpen={!!viewingLogsFor}
                onOpenChange={(open: boolean) => !open && setViewingLogsFor(null)}
                deviceId={viewingLogsFor?.deviceId || ''}
                alumnoNombre={viewingLogsFor?.alumnoNombre || ''}
            />
            <Card className="bg-[#0f1117] border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-900/50">
                            <TableRow>
                                <TableHead className="text-slate-400 font-black text-[10px] uppercase tracking-wider">Nº EQUIPO</TableHead>
                                <TableHead className="text-slate-400 font-black text-[10px] uppercase tracking-wider">ALUMNO</TableHead>
                                <TableHead className="text-slate-400 font-black text-[10px] uppercase tracking-wider">SERIAL/MAC</TableHead>
                                <TableHead className="text-left text-slate-400 font-black text-[10px] uppercase tracking-wider">INCIDENCIAS (HOY)</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-8 bg-slate-800" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48 bg-slate-800" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32 bg-slate-800" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24 bg-slate-800" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 bg-slate-800" /></TableCell>
                                </TableRow>
                            ))}
                            
                            {!loading && students.map(student => {
                                const deviceId = student.deviceId || student.id;
                                const infractionsCount = infraccionesHoy.get(deviceId) || 0;
                                
                                return (
                                    <TableRow key={student.id} className="hover:bg-white/5 transition-colors border-b border-slate-800">
                                        <TableCell className="font-mono font-bold text-white">
                                            #{student.nro_equipo}
                                        </TableCell>
                                        <TableCell className="font-medium text-white">
                                            {student.nombre_alumno}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-slate-400">
                                            {student.macAddress}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                onClick={() => setViewingLogsFor({ 
                                                    deviceId: deviceId, 
                                                    alumnoNombre: student.nombre_alumno 
                                                })}
                                                className={`h-auto px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider ${
                                                    infractionsCount > 0 
                                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                                                    : 'bg-slate-800 text-slate-500 cursor-default hover:bg-slate-800 border border-slate-700'
                                                }`}
                                                disabled={infractionsCount === 0}
                                            >
                                                {infractionsCount > 0 && (
                                                    <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                                )}
                                                {infractionsCount} {infractionsCount === 1 ? 'Intento' : 'Intentos'}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-[#1a1d26] border-slate-700 text-white">
                                                    <DropdownMenuItem onClick={() => setEditingStudent(student)} className="hover:bg-orange-500/20 focus:bg-orange-500/20">
                                                        <Edit className="mr-2 h-4 w-4 text-orange-500" />
                                                        Reasignar Alumno
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
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
                </div>
                
                {!loading && students.length === 0 && (
                    <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-b-2xl mx-6 my-8">
                        <User className="mx-auto h-12 w-12 opacity-30" />
                        <h3 className="mt-4 text-sm font-black uppercase italic">No hay alumnos en esta aula</h3>
                        <p className="mt-1 text-[10px] text-slate-600">Vincula un dispositivo desde la sección de Vinculación.</p>
                    </div>
                )}
            </Card>
        </>
    );
}
