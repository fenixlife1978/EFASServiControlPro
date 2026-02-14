'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, Server } from 'lucide-react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { confirmEnrollment } from '@/lib/firestore';
import type { PendingEnrollment } from '@/lib/firestore-types';
import { useFirestore } from '@/firebase';

interface EnrollmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string | null;
  pendingEnrollment: PendingEnrollment | null;
  onConfirmed: () => void;
  institutionId: string;
}

type Inputs = {
  nombre_alumno: string;
};

export function EnrollmentModal({
  isOpen,
  onOpenChange,
  enrollmentId,
  pendingEnrollment,
  onConfirmed,
  institutionId,
}: EnrollmentModalProps) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<Inputs>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firestore = useFirestore();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    if (!firestore || !enrollmentId || !pendingEnrollment) {
      setError('Faltan datos de inscripción para confirmar.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await confirmEnrollment({
        firestore,
        enrollmentId,
        pendingData: pendingEnrollment,
        studentName: data.nombre_alumno,
        institutionId: institutionId
      });
      onConfirmed();
      reset();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'No se pudo confirmar la inscripción.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pendingEnrollment) {
    return null; 
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Inscripción de Dispositivo</DialogTitle>
          <DialogDescription>
            Un nuevo dispositivo está listo para ser asignado a un estudiante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <Alert variant="default">
                <Server className="h-4 w-4" />
                <AlertTitle>Información del Dispositivo</AlertTitle>
                <AlertDescription>
                    <div className="text-sm">
                        <p><strong>Modelo:</strong> {pendingEnrollment.deviceInfo.model}</p>
                        <p><strong>MAC:</strong> {pendingEnrollment.deviceInfo.macAddress}</p>
                        <p><strong>Aula:</strong> {pendingEnrollment.classroomId}</p>
                    </div>
                </AlertDescription>
            </Alert>
            <form id="enrollment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="studentName">Nombre del Alumno</Label>
                    <Input
                        id="studentName"
                        placeholder="Ej: Juan Pérez"
                        {...register('nombre_alumno', { required: 'El nombre del alumno es obligatorio.' })}
                    />
                    {errors.nombre_alumno && <p className="text-sm text-red-500">{errors.nombre_alumno.message}</p>}
                </div>
            </form>
            {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="enrollment-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Inscripción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
