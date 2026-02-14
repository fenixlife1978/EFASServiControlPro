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
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { EnrollmentModal } from '@/components/admin/enrollment-modal';
import type { PendingEnrollment, Classroom } from '@/lib/firestore-types';
import { useInstitution } from '../../institution-context';
import { AdminUserNav } from '@/components/common/admin-user-nav';

export default function EnrollmentPage() {
    const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
    const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const firestore = useFirestore();
    const { toast } = useToast();
    const { institutionId } = useInstitution();

    // Fetch classrooms
    const classroomsRef = useMemoFirebase(() => {
        if (!firestore || !institutionId) return null;
        return collection(firestore, 'institutions', institutionId, 'Aulas');
    }, [firestore, institutionId]);
    const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsRef);

    // Listen for pending enrollment
    const enrollmentDocRef = useMemoFirebase(() => {
        if (!firestore || !enrollmentId) return null;
        return doc(firestore, 'pending_enrollments', enrollmentId);
    }, [firestore, enrollmentId]);

    const { data: pendingEnrollment } = useDoc<PendingEnrollment>(enrollmentDocRef);

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
                    <h2 className="text-2xl font-black text-slate-800">Inscripción de Dispositivos</h2>
                    <p className="text-slate-500 text-sm">Genera un código QR para que un nuevo dispositivo se una a un aula.</p>
                </div>
                <AdminUserNav />
            </header>

            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Generador de Código QR</CardTitle>
                    <CardDescription>
                        Selecciona un aula para generar un código QR único de inscripción.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!qrValue ? (
                         <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="classroom-select">Seleccionar Aula</Label>
                                <Select onValueChange={setSelectedClassroom} value={selectedClassroom || ''} disabled={classroomsLoading}>
                                    <SelectTrigger id="classroom-select">
                                        <SelectValue placeholder={classroomsLoading ? "Cargando aulas..." : "Selecciona un aula..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classrooms?.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.nombre_completo}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleGenerateQR} disabled={!selectedClassroom || classroomsLoading} className="w-full">
                                {classroomsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                                Generar Código QR
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center text-muted-foreground space-y-4">
                            <div className='p-4 bg-white rounded-lg'>
                                <QRCode value={qrValue} size={256} />
                            </div>
                           
                            <Alert>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <AlertTitle>Esperando Escaneo...</AlertTitle>
                                <AlertDescription>
                                    Pídele al usuario de la tablet que escanee este código para iniciar el proceso de inscripción.
                                </AlertDescription>
                            </Alert>

                            <Button onClick={resetFlow} variant="outline">
                                Cancelar / Generar Otro
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
