"use client"

import { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config'; // Asegúrate de tener exportado rtdb (getDatabase)
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
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
    nro_equipo: string;
    deviceId: string;
    macAddress: string;
}

export function StudentsTable({ institutionId, classroomId }: StudentsTableProps) {
    const [students, setStudents] = useState<Alumno[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingStudent, setEditingStudent] = useState<Alumno | null>(null);
    const [viewingLogsFor, setViewingLogsFor] = useState<{ deviceId: string; alumnoNombre: string } | null>(null);
    
    // Almacenamos las infracciones de RTDB para que sea instantáneo
    const [infraccionesRealtime, setInfraccionesRealtime] = useState<Record<string, number>>({});

    // 1. ESCUCHA DE ALUMNOS (Firestore)
    useEffect(() => {
        if (!institutionId || !classroomId) return;

        const q = query(
            collection(db, "usuarios"),
            where("InstitutoId", "==", institutionId),
            where("aulaId", "==", classroomId),
            where("rol", "==", "alumno")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const alumnosData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    nombre_alumno: data.nombre || data.alumno_asignado || 'Sin nombre',
                    nro_equipo: data.nro_equipo || 'N/A',
                    deviceId: data.deviceId || doc.id,
                    macAddress: data.macAddress || 'N/A',
                };
            });
            setStudents(alumnosData);
            setLoading(false);
        }, (error) => {
            console.error("Error escuchando alumnos:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [institutionId, classroomId]);

    // 2. ESCUCHA DE INFRACCIONES (Realtime Database - Híbrido)
    // Escuchamos la rama de "incidencias_count" o similar en RTDB para cada alumno
    useEffect(() => {
        if (students.length === 0) return;

        const unsubscribesRTDB: (() => void)[] = [];

        students.forEach((student) => {
            const deviceId = student.deviceId;
            // Asumiendo que en RTDB tienes una ruta: /monitoring/{deviceId}/today_incidents
            const incidentRef = ref(rtdb, `monitoring/${deviceId}/today_incidents`);
            
            const unsub = onValue(incidentRef, (snapshot) => {
                const count = snapshot.val() || 0;
                setInfraccionesRealtime(prev => ({
                    ...prev,
                    [deviceId]: count
                }));
            });

            unsubscribesRTDB.push(unsub);
        });

        return () => unsubscribesRTDB.forEach(u => u());
    }, [students]);

    return (
        <>
            <InfractionLogModal
                isOpen={!!viewingLogsFor}
                onOpenChange={(open: boolean) => !open && setViewingLogsFor(null)}
                deviceId={viewingLogsFor?.deviceId || ''}
                alumnoNombre={viewingLogsFor?.alumnoNombre || ''}
            />
            
            <Card className="bg-[#0f1117] border border-slate-800 overflow-hidden rounded-[1.5rem] shadow-2xl">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-900/40">
                            <TableRow className="border-b border-slate-800 hover:bg-transparent">
                                <TableHead className="text-slate-500 font-black text-[10px] uppercase tracking-tighter py-5">Nº EQUIPO</TableHead>
                                <TableHead className="text-slate-500 font-black text-[10px] uppercase tracking-tighter">ALUMNO / ESTUDIANTE</TableHead>
                                <TableHead className="text-slate-500 font-black text-[10px] uppercase tracking-tighter">IDENTIFICADOR MAC</TableHead>
                                <TableHead className="text-left text-slate-500 font-black text-[10px] uppercase tracking-tighter">ESTADO INCIDENCIAS</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i} className="border-b border-slate-800/50">
                                        <TableCell><Skeleton className="h-4 w-8 bg-slate-800" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48 bg-slate-800" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32 bg-slate-800" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-24 rounded-full bg-slate-800" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded-full bg-slate-800" /></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                students.map(student => {
                                    const count = infraccionesRealtime[student.deviceId] || 0;
                                    
                                    return (
                                        <TableRow key={student.id} className="hover:bg-white/[0.02] transition-colors border-b border-slate-800/50">
                                            <TableCell className="font-mono font-black text-orange-500">
                                                #{student.nro_equipo}
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-200">
                                                {student.nombre_alumno}
                                            </TableCell>
                                            <TableCell className="font-mono text-[11px] text-slate-500 uppercase">
                                                {student.macAddress}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setViewingLogsFor({ 
                                                        deviceId: student.deviceId, 
                                                        alumnoNombre: student.nombre_alumno 
                                                    })}
                                                    className={`h-7 px-4 rounded-full font-black text-[10px] uppercase transition-all ${
                                                        count > 0 
                                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 animate-pulse' 
                                                        : 'bg-emerald-500/5 text-emerald-500/40 cursor-default border border-emerald-500/10'
                                                    }`}
                                                    disabled={count === 0}
                                                >
                                                    {count > 0 && <AlertTriangle className="w-3 h-3 mr-1.5" />}
                                                    {count} {count === 1 ? 'Incidencia' : 'Incidencias'}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-white hover:bg-white/10">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-[#161922] border-slate-800 text-slate-300">
                                                        <DropdownMenuItem onClick={() => setEditingStudent(student)} className="gap-2 focus:bg-orange-500/10 focus:text-orange-500 cursor-pointer font-bold text-xs">
                                                            <Edit className="h-3.5 w-3.5" /> Reasignar Alumno
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="gap-2 focus:bg-red-500/10 focus:text-red-500 cursor-pointer font-bold text-xs">
                                                            <Trash2 className="h-3.5 w-3.5" /> Desvincular
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {!loading && students.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40 italic">
                        <User className="h-10 w-10 mb-4" />
                        <p className="text-xs uppercase font-black tracking-widest">Aula sin dispositivos asignados</p>
                    </div>
                )}
            </Card>
        </>
    );
}
