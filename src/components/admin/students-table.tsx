"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, rtdb } from '@/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue, off, get, set } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, User, Edit, Trash2, AlertTriangle, ShieldCheck, Filter, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
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
    
    // Estado para conteo de infracciones por dispositivo
    const [infraccionesRealtime, setInfraccionesRealtime] = useState<Record<string, number>>({});
    const [allIncidents, setAllIncidents] = useState<any[]>([]);
    
    // Filtros
    const [timeRange, setTimeRange] = useState<string>('24h');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    
    // Helper para obtener timestamp según rango (solo 24h y 72h)
    const getTimeRangeTimestamp = (range: string): number => {
        const now = Date.now();
        switch(range) {
            case '24h': return now - (24 * 60 * 60 * 1000);
            case '72h': return now - (72 * 60 * 60 * 1000);
            default: return now - (72 * 60 * 60 * 1000);
        }
    };
    
    // Helper para obtener etiqueta del rango
    const getTimeRangeLabel = (range: string): string => {
        switch(range) {
            case '24h': return 'Últimas 24 horas';
            case '72h': return 'Últimas 72 horas';
            default: return 'Últimas 72 horas';
        }
    };

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

    // 2. ESCUCHA DE INFRACCIONES DESDE alertas_seguridad (RTDB) con filtro de tiempo
    useEffect(() => {
        if (students.length === 0) return;

        const deviceIds = students.map(s => s.deviceId);
        const alertasRef = ref(rtdb, 'alertas_seguridad');
        
        const unsubscribe = onValue(alertasRef, (snapshot) => {
            const data = snapshot.val();
            const counts: Record<string, number> = {};
            const incidentsList: any[] = [];
            
            deviceIds.forEach(id => { counts[id] = 0; });
            
            if (data) {
                Object.entries(data).forEach(([key, value]: [string, any]) => {
                    const deviceId = value.deviceId;
                    if (deviceId && deviceIds.includes(deviceId)) {
                        const isBlockAlert = [
                            'busqueda_prohibida', 'url_prohibida', 'app_prohibida', 
                            'app_restringida', 'configuracion_navegador', 'ajustes_sistema', 'modo_blindado'
                        ].includes(value.tipo);
                        
                        if (isBlockAlert) {
                            counts[deviceId]++;
                            incidentsList.push({
                                id: key,
                                deviceId: deviceId,
                                timestamp: value.timestamp || 0,
                                tipo: value.tipo
                            });
                        }
                    }
                });
            }
            
            setInfraccionesRealtime(counts);
            setAllIncidents(incidentsList);
        }, (error) => {
            console.error("Error escuchando alertas:", error);
        });

        return () => off(alertasRef);
    }, [students]);

    // 3. Filtrar estudiantes por rango de tiempo (solo los que tienen infracciones en el período)
    const filteredStudents = useMemo(() => {
        const timeLimit = getTimeRangeTimestamp(timeRange);
        
        // Obtener deviceIds que tienen infracciones dentro del período
        const recentIncidentDevices = new Set<string>();
        allIncidents.forEach(incident => {
            if (incident.timestamp >= timeLimit) {
                recentIncidentDevices.add(incident.deviceId);
            }
        });
        
        // Para cada estudiante, calcular su conteo de infracciones en el período
        return students.map(student => {
            let countInPeriod = 0;
            allIncidents.forEach(incident => {
                if (incident.deviceId === student.deviceId && incident.timestamp >= timeLimit) {
                    countInPeriod++;
                }
            });
            
            return {
                ...student,
                infraccionesPeriodo: countInPeriod,
                tieneInfraccionesRecientes: countInPeriod > 0
            };
        });
    }, [students, allIncidents, timeRange]);

    // 4. Paginación
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return filteredStudents.slice(start, end);
    }, [filteredStudents, currentPage, itemsPerPage]);

    // Resetear página cuando cambia el filtro
    useEffect(() => {
        setCurrentPage(1);
    }, [timeRange]);

    if (loading) {
        return (
            <Card className="bg-[#0f1117] border border-white/5 overflow-hidden rounded-[2rem] shadow-2xl">
                <div className="p-8 text-center">
                    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">Cargando terminales...</p>
                </div>
            </Card>
        );
    }

    return (
        <>
            <InfractionLogModal
                isOpen={!!viewingLogsFor}
                onOpenChange={(open: boolean) => !open && setViewingLogsFor(null)}
                deviceId={viewingLogsFor?.deviceId || ''}
                alumnoNombre={viewingLogsFor?.alumnoNombre || ''}
            />
            
            <Card className="bg-[#0f1117] border border-white/5 overflow-hidden rounded-[2rem] shadow-2xl">
                {/* Header con filtros */}
                <div className="px-6 pt-6 pb-4 border-b border-white/5 flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h3 className="text-white font-black uppercase italic text-sm flex items-center gap-2">
                            <ShieldCheck size={16} className="text-orange-500" />
                            Terminales del Aula
                        </h3>
                        <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                            {getTimeRangeLabel(timeRange)} • {filteredStudents.length} estudiantes
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl px-3 py-1.5 border border-slate-700">
                            <Clock size={12} className="text-orange-500" />
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                className="bg-transparent text-[9px] font-black text-white uppercase tracking-wider focus:outline-none cursor-pointer"
                            >
                                <option value="24h">ÚLTIMAS 24 HORAS</option>
                                <option value="72h">ÚLTIMAS 72 HORAS</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Contador y paginación */}
                <div className="px-6 pt-3 pb-2 flex justify-between items-center">
                    <p className="text-[7px] text-slate-500">
                        Mostrando {paginatedStudents.length} de {filteredStudents.length} terminales
                    </p>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={12} className="text-white" />
                            </button>
                            <span className="text-[7px] text-slate-400 font-mono">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={12} className="text-white" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Tabla */}
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
                            {paginatedStudents.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="bg-slate-900/50 p-4 rounded-3xl mb-4 border border-white/5">
                                                <User className="h-8 w-8 text-slate-700" />
                                            </div>
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Aula sin terminales activos</p>
                                            <p className="text-[8px] text-slate-700 mt-2">{getTimeRangeLabel(timeRange)}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedStudents.map(student => {
                                    const count = student.infraccionesPeriodo;
                                    
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
                                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20' 
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
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </>
    );
}