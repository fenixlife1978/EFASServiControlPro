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
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, doc, DocumentReference, CollectionReference, Query } from 'firebase/firestore';
import { EnrollmentModal } from '@/components/admin/enrollment-modal';
import type { PendingEnrollment, Classroom } from '@/lib/firestore-types';
import { useInstitution } from '../institution-context';
import { AdminUserNav } from '@/components/common/admin-user-nav';

export default function EnrollmentPage() {
    const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
    const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const firestore = useFirestore();
    const { toast } = useToast();
    const { institutionId } = useInstitution();

    // Corrección Error 2345: Casting a Query para que acepte la referencia o null
    const classroomsRef = useMemo(() => {
        if (!firestore || !institutionId) return null;
        return collection(firestore, 'institutions', institutionId, 'Aulas') as unknown as Query<Classroom>;
    }, [firestore, institutionId]);

    // Usamos 'any' en el hook solo si el null da problemas, o pasamos la ref directamente
    const classroomsResult = useCollection(classroomsRef as any);
    const classrooms = classroomsResult?.value;
    const classroomsLoading = classroomsResult?.loading;

    const enrollmentDocRef = useMemo(() => {
        if (!firestore || !enrollmentId) return null;
        return doc(firestore, 'pending_enrollments', enrollmentId) as DocumentReference<PendingEnrollment>;
    }, [firestore, enrollmentId]);

    // Corrección Error 2339: Accedemos al valor según la estructura real de tu DocumentHook
    // Si 'data' no existe, usualmente en estos hooks es 'value'
    const enrollmentResult = useDoc<PendingEnrollment>(enrollmentDocRef as any);
    const pendingEnrollment = (enrollmentResult as any)?.value || (enrollmentResult as any)?.data;

    useEffect(() => {
        if (pendingEnrollment) {
            toast({
                title: "Dispositivo detectado",
                description: `Un nuevo dispositivo está listo para ser confirmado.`,
            });
            setIsModalOpen(true);
        }
    }, [pendingEnrollment, toast]);

    const handleGenerateQR = () => {
        if (!selectedClassroom) {
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Por favor, selecciona un aula.",
            });
            return;
        }
        if (firestore) {
            const newEnrollmentId = doc(collection(firestore, '_')).id;
            setEnrollmentId(newEnrollmentId);
        }
    };
    
    const qrValue = useMemo(() => {
        if (!enrollmentId || !selectedClassroom || !institutionId) return null;
        return JSON.stringify({
            enrollmentId: enrollmentId,
            classroomId: selectedClassroom,
            institutionId: institutionId,
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
                    <p className="text-slate-500 text-sm font-medium">EDUControlPro Sistema de Control Parental Educativo • Gestión de Acceso</p>
                </div>
                <AdminUserNav />
            </header>

            <Card className="max-w-md mx-auto border-2 border-slate-100 shadow-xl rounded-3xl">
                <CardHeader className="bg-slate-50/50 border-b">
                    <CardTitle className="text-xl font-bold uppercase tracking-tight text-slate-700">Generador de Código QR</CardTitle>
                    <CardDescription>Selecciona un aula para vincular la tablet.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {!qrValue ? (
                         <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="classroom-select" className="font-bold text-[10px] uppercase text-slate-400 tracking-[0.2em]">Configurar Aula</Label>
                                <Select onValueChange={setSelectedClassroom} value={selectedClassroom || ''} disabled={classroomsLoading}>
                                    <SelectTrigger id="classroom-select" className="h-12 rounded-xl border-slate-200">
                                        <SelectValue placeholder={classroomsLoading ? "Cargando..." : "Seleccionar..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(classrooms as any[])?.map((c: Classroom) => (
                                            <SelectItem key={c.id} value={c.id}>{c.nombre_completo}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleGenerateQR} disabled={!selectedClassroom || classroomsLoading} className="w-full h-12 bg-orange-600 hover:bg-orange-500 font-black rounded-xl shadow-lg shadow-orange-600/20 transition-all">
                                {classroomsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                                GENERAR QR DE ACCESO
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className='p-6 bg-white rounded-[2rem] shadow-inner border border-slate-100'>
                                <QRCode value={qrValue} size={250} level="H" />
                            </div>
                           
                            <Alert className="bg-orange-50 border-orange-200 rounded-2xl">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                                <AlertTitle className="font-black italic uppercase text-orange-800 text-xs">Vínculo Pendiente</AlertTitle>
                                <AlertDescription className="text-orange-700 font-medium text-[10px] uppercase tracking-wider">
                                    Escanea desde la tablet para enrolar.
                                </AlertDescription>
                            </Alert>

                            <Button onClick={resetFlow} variant="ghost" className="text-slate-400 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest">
                                Cancelar Proceso
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
