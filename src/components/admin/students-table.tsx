"use client";

import { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, User, Edit, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
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
    const [viewingLogsFor, setViewingLogsFor] = useState<{ deviceId: string; alumnoNombre: string } | null>(null);
    
    // Estado híbrido para infracciones en tiempo real
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

    // 2. ESCUCHA DE INFRACCIONES (Realtime Database - Sistema Centinela)
    useEffect(() => {
        if (students.length === 0) return;

        // Guardamos las referencias para poder limpiar los listeners correctamente
        const activeRefs: { path: string; ref: any }[] = [];

        students.forEach((student) => {
            const deviceId = student.deviceId;
            // Ruta optimizada en RTDB para conteos diarios
            const incidentPath = `monitoring/${deviceId}/today_incidents`;
            const incidentRef = ref(rtdb, incidentPath);
            
            onValue(incidentRef, (snapshot) => {
                const count = snapshot.val() || 0;
                setInfraccionesRealtime(prev => ({
                    ...prev,
                    [deviceId]: count
                }));
            });

            activeRefs.push({ path: incidentPath, ref: incidentRef });
        });

        // Limpieza: quitamos todos los listeners al desmontar o cambiar estudiantes
        return () => {
            activeRefs.forEach(item => off(item.ref));
        };
    }, [students]);

    return (
        <>
            <InfractionLogModal
                isOpen={!!viewingLogsFor}
                onOpenChange={(open: boolean) => !open && setViewingLogsFor(null)}
                deviceId={viewingLogsFor?.deviceId || ''}
                alumnoNombre={viewingLogsFor?.alumnoNombre || ''}
            />
            
            <Card className="bg-[#0f1117] border border-white/5 overflow-hidden rounded-[2rem] shadow-2xl">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-white/[0.02]">
                            <TableRow className="border-b border-white/5 hover:bg-transparent">
                                <TableHead className="text-slate-500 font-black text-[10px] uppercase tracking-widest py-6 pl-8">Nº EQUIPO</TableHead>
                                <TableHead className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Estudiante</TableHead>
                                <TableHead className="text-slate-500 font-black text-[10px] uppercase tracking-widest">ID Dispositivo</TableHead>
                                <TableHead className="text-left text-slate-500 font-black text-[10px] uppercase tracking-widest">Estatus Centinela</TableHead>
                                <TableHead className="w-[80px] pr-8"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i} className="border-b border-white/5">
                                        <TableCell className="pl-8"><Skeleton className="h-4 w-8 bg-white/5" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48 bg-white/5" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32 bg-white/5" /></TableCell>
                                        <TableCell><Skeleton className="h-7 w-24 rounded-full bg-white/5" /></TableCell>
                                        <TableCell className="pr-8"><Skeleton className="h-8 w-8 rounded-full bg-white/5" /></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                students.map(student => {
                                    const count = infraccionesRealtime[student.deviceId] || 0;
                                    
                                    return (
                                        <TableRow key={student.id} className="hover:bg-white/[0.01] transition-colors border-b border-white/5 group">
                                            <TableCell className="font-mono font-black text-orange-500 text-xs pl-8">
                                                #{student.nro_equipo}
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-200 text-sm">
                                                {student.nombre_alumno}
                                            </TableCell>
                                            <TableCell className="font-mono text-[10px] text-slate-500 uppercase tracking-tight">
                                                {student.deviceId.slice(0, 18)}...
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setViewingLogsFor({ 
                                                        deviceId: student.deviceId, 
                                                        alumnoNombre: student.nombre_alumno 
                                                    })}
                                                    className={`h-7 px-4 rounded-full font-black text-[9px] uppercase transition-all gap-2 ${
                                                        count > 0 
                                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 animate-pulse' 
                                                        : 'bg-emerald-500/5 text-emerald-500/40 hover:text-emerald-500 hover:bg-emerald-500/10 border border-emerald-500/10'
                                                    }`}
                                                >
                                                    {count > 0 ? (
                                                        <>
                                                            <AlertTriangle className="w-3 h-3" />
                                                            {count} {count === 1 ? 'Alerta' : 'Alertas'}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldCheck className="w-3 h-3" />
                                                            Protegido
                                                        </>
                                                    )}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="pr-8">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-white hover:bg-white/10 rounded-xl">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-[#161922] border-white/5 text-slate-300 rounded-2xl p-2 shadow-2xl">
                                                        <DropdownMenuItem className="gap-3 focus:bg-orange-500/10 focus:text-orange-500 cursor-pointer font-bold text-[10px] uppercase p-3 rounded-xl transition-colors">
                                                            <Edit className="h-3.5 w-3.5" /> Reasignar Terminal
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="gap-3 focus:bg-red-500/10 focus:text-red-500 cursor-pointer font-bold text-[10px] uppercase p-3 rounded-xl transition-colors">
                                                            <Trash2 className="h-3.5 w-3.5" /> Desvincular MDM
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
                    <div className="flex flex-col items-center justify-center py-24 bg-white/[0.01]">
                        <div className="bg-slate-900/50 p-4 rounded-3xl mb-4 border border-white/5">
                            <User className="h-8 w-8 text-slate-700" />
                        </div>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Aula sin terminales activos</p>
                    </div>
                )}
            </Card>
        </>
    );
}
