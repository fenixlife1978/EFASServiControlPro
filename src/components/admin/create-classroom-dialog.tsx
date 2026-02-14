'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CreateClassroomDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  institutionId: string;
}

const formSchema = z.object({
  grado: z.string().min(1, 'El grado es obligatorio.'),
  seccion: z.string().min(1, 'La sección es obligatoria.'),
  capacidad: z.coerce.number().optional(),
});

export function CreateClassroomDialog({
  isOpen,
  onOpenChange,
  institutionId,
}: CreateClassroomDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      grado: '',
      seccion: '',
      capacidad: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore no está disponible.' });
      return;
    }
    setIsSubmitting(true);
    
    try {
        const classroomsRef = collection(firestore, 'institutions', institutionId, 'Aulas');
        const nombre_completo = `${values.grado} - Sección ${values.seccion}`;
        
        await addDocumentNonBlocking(classroomsRef, {
            institutionId,
            grado: values.grado,
            seccion: values.seccion,
            capacidad: values.capacidad || null,
            nombre_completo,
            status: 'published', // Default to published
            createdAt: serverTimestamp(),
        });

        toast({ title: 'Éxito', description: `El sector "${nombre_completo}" ha sido creado.` });
        form.reset();
        onOpenChange(false);
    } catch (error) {
        console.error('Error creating classroom: ', error);
        toast({ variant: 'destructive', title: 'Error en Firestore', description: 'No se pudo crear el sector.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-8">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">
            EFAS <span className="text-orange-500">ServiControlPro</span>
          </DialogTitle>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Configurar Nuevo Sector</p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="grado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-xs font-black text-slate-400 uppercase mb-2">Grado (Ej: 1er Grado, Nivel Inicial)</FormLabel>
                  <FormControl>
                    <Input className="bg-slate-50 border-slate-200 p-4 h-auto rounded-xl" placeholder="Grado al que pertenece el sector" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="seccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-xs font-black text-slate-400 uppercase mb-2">Identificación del Sector (Ej: "A")</FormLabel>
                  <FormControl>
                    <Input className="bg-slate-50 border-slate-200 p-4 h-auto rounded-xl" placeholder="Nombre o Letra del Sector" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="capacidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-xs font-black text-slate-400 uppercase mb-2">Cantidad de Estudiantes (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      className="bg-slate-50 border-slate-200 p-4 h-auto rounded-xl"
                      placeholder="Ej: 30"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="!flex-row gap-3 pt-4">
                <Button type="button" variant="ghost" className="flex-1 h-auto py-4 font-bold text-slate-400 hover:bg-slate-100 rounded-xl" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-auto py-4 font-bold rounded-xl shadow-lg shadow-blue-200" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSubmitting ? 'Creando...' : 'Crear Sector'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
