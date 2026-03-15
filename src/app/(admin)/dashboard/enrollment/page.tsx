'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import QRCode from 'react-qr-code';

// MIGRACIÓN: Importamos RTDB
import { rtdb } from '@/firebase/config';
import { ref, onValue, push, child } from 'firebase/database';

import { EnrollmentModal } from '@/components/admin/enrollment-modal';
import type { PendingEnrollment, Classroom } from '@/lib/firestore-types';
import { useInstitution } from '../institution-context';
import { AdminUserNav } from '@/components/common/admin-user-nav';

export default function EnrollmentPage() {
    const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
    const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Estados para los datos de RTDB
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [classroomsLoading, setClassroomsLoading] = useState(true);
    const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(null);
    
    const { toast } = useToast();
    const { institutionId } = useInstitution();

    // 1. Cargar Aulas desde RTDB
    useEffect(() => {
        if (!institutionId) return;

        // Asumimos la ruta: instituciones/ID/aulas
        const classroomsRef = ref(rtdb, `instituciones/${institutionId}/aulas`);
        
        const unsub = onValue(classroomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setClassrooms(list);
            } else {
                setClassrooms([]);
            }
            setClassroomsLoading(false);
        });

        return () => unsub();
    }, [institutionId]);

    // 2. Escuchar la vinculación pendiente (Cuando la APK escribe en RTDB)
    useEffect(() => {
        if (!enrollmentId) {
            setPendingEnrollment(null);
            return;
        }

        // Ruta: pending_enrollments/ID_GENERADO
        const enrollmentRef = ref(rtdb, `pending_enrollments/${enrollmentId}`);
        
        const unsub = onValue(enrollmentRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setPendingEnrollment(data);
                
                toast({
                    title: "Dispositivo detectado",
                    description: `Un nuevo dispositivo está listo para ser confirmado.`,
                });
                setIsModalOpen(true);
            }
        });

        return () => unsub();
    }, [enrollmentId, toast]);

    // 3. Generar ID único para el QR
    const handleGenerateQR = () => {
        if (!selectedClassroom) {
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Por favor, selecciona un aula.",
            });
            return;
        }
        
        // Generamos un ID único usando push() sin escribir aún
        const newEnrollmentId = push(child(ref(rtdb), 'pending_enrollments')).key;
        setEnrollmentId(newEnrollmentId);
    };
    
    const qrValue = useMemo(() => {
        if (!enrollmentId || !selectedClassroom || !institutionId) return null;
        return JSON.stringify({
            deviceId: enrollmentId,
            aulaId: selectedClassroom,
            InstitutoId: institutionId,
        });
    }, [enrollmentId, selectedClassroom, institutionId]);

    const handleEnrollmentConfirmed = () => {
        setIsModalOpen(false);
        setEnrollmentId(null);
        setSelectedClassroom(null);
        toast({
            title: "Éxito",
            description: "El dispositivo ha sido enrolado y configurado exitosamente.",
        });
    }

    const resetFlow = () => {
        setEnrollmentId(null);
        setSelectedClassroom(null);
    }

    return (
        <div className="space-y-8">
            <EnrollmentModal 
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                enrollmentId={enrollmentId}
                pendingEnrollment={pendingEnrollment}
                onConfirmed={handleEnrollmentConfirmed}
                institutionId={institutionId!}
            />

            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 italic uppercase">Inscripción de Dispositivos</h2>
                    <p className="text-slate-500 text-sm font-medium">EFAS ServiControlPro • Gestión de Acceso</p>
                </div>
                <AdminUserNav />
            </header>

            <Card className="max-w-md mx-auto border-2 border-slate-100 shadow-xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-8">
                    <CardTitle className="text-xl font-black uppercase italic tracking-tight text-slate-700">Generador de Código QR</CardTitle>
                    <CardDescription className="font-bold text-slate-400 text-[10px] uppercase">Selecciona un aula para vincular la unidad.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {!qrValue ? (
                         <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="classroom-select" className="font-bold text-[10px] uppercase text-slate-400 tracking-[0.2em]">Configurar Ubicación</Label>
                                <Select onValueChange={setSelectedClassroom} value={selectedClassroom || ''} disabled={classroomsLoading}>
                                    <SelectTrigger id="classroom-select" className="h-14 rounded-2xl border-slate-200 shadow-inner">
                                        <SelectValue placeholder={classroomsLoading ? "Cargando Aulas..." : "Seleccionar Aula..."} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl shadow-xl">
                                        {classrooms.map((c) => (
                                            <SelectItem key={c.id} value={c.id} className="font-bold text-slate-600 uppercase italic text-xs">
                                                {c.nombre_completo || c.id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleGenerateQR} disabled={!selectedClassroom || classroomsLoading} className="w-full h-14 bg-orange-600 hover:bg-orange-500 font-black rounded-2xl shadow-lg shadow-orange-600/20 transition-all uppercase italic">
                                {classroomsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                                GENERAR QR DE ACCESO
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className='p-8 bg-white rounded-[3rem] shadow-inner border-2 border-slate-100 group transition-all hover:border-orange-200'>
                                <QRCode value={qrValue} size={250} level="H" />
                            </div>
                           
                            <Alert className="bg-orange-50 border-orange-200 rounded-3xl p-5 shadow-sm">
                                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                                <AlertTitle className="font-black italic uppercase text-orange-800 text-xs ml-2 tracking-tighter">Vínculo Pendiente</AlertTitle>
                                <AlertDescription className="text-orange-700 font-bold text-[10px] uppercase tracking-[0.2em] ml-2 mt-1">
                                    Escanea desde la tablet para enrolar.
                                </AlertDescription>
                            </Alert>

                            <Button onClick={resetFlow} variant="ghost" className="text-slate-400 hover:text-red-500 font-black text-[10px] uppercase tracking-[0.3em] italic">
                                Cancelar Proceso
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
