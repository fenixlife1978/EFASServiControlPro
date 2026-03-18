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
  DialogTrigger,
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
import { addDocumentNonBlocking } from '@/firebase';
import { rtdb } from '@/firebase/config';
import { ref, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CreateClassroomDialogProps {
  InstitutoId: string;
  children: React.ReactNode;
}

const formSchema = z.object({
  grado: z.string().min(1, 'El grado es obligatorio.'),
  seccion: z.string().min(1, 'La sección es obligatoria.'),
  capacidad: z.coerce.number().optional(),
});

export function CreateClassroomDialog({
  InstitutoId,
  children,
}: CreateClassroomDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!InstitutoId) {
      toast({ variant: 'destructive', title: 'Error', description: 'No hay un InstitutoId activo.' });
      return;
    }

    setIsSubmitting(true);
    
    try {
        const path = `institutions/${InstitutoId}/Aulas`;
        const nombre_completo = `${values.grado} - Sección ${values.seccion}`;
        
        // 1. Crear en Firestore
        const result = await addDocumentNonBlocking(path, {
            grado: values.grado,
            seccion: values.seccion,
            capacidad: values.capacidad || null,
            nombre_completo,
            status: 'published',
        });

        if (result.success && result.id) {
            // 2. Sincronizar con RTDB para carga inmediata en dispositivos
            const aulaRtdbRef = ref(rtdb, `estructuras/${InstitutoId}/aulas/${result.id}`);
            await set(aulaRtdbRef, {
                id: result.id,
                nombre: nombre_completo,
                seccion: values.seccion,
                grado: values.grado
            });

            toast({ title: 'Éxito', description: `El salon/aula "${nombre_completo}" ha sido creado.` });
            form.reset();
            setOpen(false);
        } else {
            throw new Error(result.error);
        }
    } catch (error: any) {
        console.error('Error creating classroom: ', error);
        toast({ 
          variant: 'destructive', 
          title: 'Error de Sincronización', 
          description: error.message || 'No se pudo crear el salon/aula.' 
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-[2rem] p-8 border-slate-200 shadow-2xl">
        <DialogHeader className="mb-2 text-center sm:text-left">
          <DialogTitle className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">
            EDU <span className="text-orange-500">ControlPro</span>
          </DialogTitle>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Configurar Nuevo Salon/Aula</p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="grado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Grado (Ej: 1er Grado)</FormLabel>
                  <FormControl>
                    <Input className="bg-slate-50 border-slate-200 p-4 h-auto rounded-2xl font-bold focus:ring-orange-500/20" placeholder="Grado al que pertenece el salon" {...field} />
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
                  <FormLabel className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Sección / Identificación (Ej: "A")</FormLabel>
                  <FormControl>
                    <Input className="bg-slate-50 border-slate-200 p-4 h-auto rounded-2xl font-bold focus:ring-orange-500/20" placeholder="Nombre o Letra de la sección" {...field} />
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
                  <FormLabel className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Capacidad (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      className="bg-slate-50 border-slate-200 p-4 h-auto rounded-2xl font-bold focus:ring-orange-500/20"
                      placeholder="Ej: 30"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button type="button" variant="ghost" className="flex-1 h-auto py-4 font-black text-[10px] uppercase text-slate-400 hover:bg-slate-100 rounded-2xl transition-all" onClick={() => setOpen(false)} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-auto py-4 font-black text-[10px] uppercase rounded-2xl bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-200 transition-all text-white" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSubmitting ? 'Creando...' : 'Crear Salon/Aula'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
