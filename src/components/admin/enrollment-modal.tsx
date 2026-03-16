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
import { Loader2, MonitorSmartphone, ShieldAlert } from 'lucide-react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { confirmEnrollment } from '@/lib/firestore';
import type { PendingEnrollment } from '@/lib/firestore-types';
import { useFirestore } from '@/firebase';
import { Badge } from '../ui/badge';

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
      setError('Faltan datos críticos para procesar el alta.');
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
        institutionId: institutionId,
        aulaId: (pendingEnrollment as any).aulaId || pendingEnrollment.classroomId || '',
        seccion: (pendingEnrollment as any).seccion || ''
      });
      onConfirmed();
      reset();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error en la sincronización con EDUControlPro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pendingEnrollment) return null; 

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0f1117] border border-slate-800 rounded-[2.5rem] p-8">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20">
                <MonitorSmartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tighter">
                Confirmar <span className="text-orange-500">Inscripción</span>
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                Vinculación de Hardware EDUControlPro
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
            <Alert className="bg-slate-900/50 border-slate-800 rounded-2xl border-l-4 border-l-orange-500 py-4">
                <AlertTitle className="text-[11px] font-black text-white uppercase italic mb-3 flex items-center gap-2">
                    <ShieldAlert className="h-3 w-3 text-orange-500" /> Detalle de Terminal
                </AlertTitle>
                <AlertDescription>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-500 uppercase">MAC / Device ID</p>
                            <p className="text-[10px] font-mono font-bold text-slate-300 truncate tracking-tighter">
                                {(pendingEnrollment as any).deviceId}
                            </p>
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-[8px] font-black text-slate-500 uppercase">Ubicación Aula</p>
                            <Badge className="bg-orange-500/10 text-orange-500 text-[9px] font-black uppercase border-none px-2 italic">
                                {(pendingEnrollment as any).aulaId || pendingEnrollment.classroomId} - SECC. {(pendingEnrollment as any).seccion || 'A'}
                            </Badge>
                        </div>
                    </div>
                </AlertDescription>
            </Alert>

            <form id="enrollment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Asignar a Estudiante
                    </Label>
                    <Input
                        placeholder="INGRESE NOMBRE COMPLETO"
                        className="bg-slate-950 border-slate-800 text-white rounded-xl h-12 font-bold focus:ring-orange-500/20 uppercase text-xs"
                        {...register('nombre_alumno', { required: 'El nombre es obligatorio para el registro.' })}
                    />
                    {errors.nombre_alumno && (
                        <p className="text-[10px] font-black text-red-500 uppercase italic ml-1">
                            {errors.nombre_alumno.message}
                        </p>
                    )}
                </div>
            </form>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-[10px] font-black text-red-500 uppercase italic text-center">
                        {error}
                    </p>
                </div>
            )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-800/50"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form="enrollment-form" 
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase shadow-lg shadow-orange-500/20 transition-all"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar Alta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
