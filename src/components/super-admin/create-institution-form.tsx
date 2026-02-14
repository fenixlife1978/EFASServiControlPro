'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';

const formSchema = z.object({
  nombre: z.string().min(3, 'El nombre es obligatorio.'),
  condoId: z.string().min(1, 'El ID es obligatorio.'),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

export function CreateInstitutionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: '',
      condoId: '',
      logoUrl: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) return;
    setIsSubmitting(true);
    
    try {
        const institutionsRef = collection(firestore, 'institutions');
        await addDocumentNonBlocking(institutionsRef, {
            nombre: values.nombre,
            condoId: values.condoId.trim().toUpperCase(),
            logoUrl: values.logoUrl,
            status: 'unpublished',
            modoFiltro: 'Blacklist',
            superAdminSuspended: false,
            direccion: '',
            createdAt: serverTimestamp(),
        });

        toast({ title: 'Éxito', description: `La institución "${values.nombre}" ha sido creada.` });
        form.reset();
    } catch (error) {
        console.error('Error creating institution: ', error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear la institución.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap gap-4 items-end">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-slate-400 ml-1">NOMBRE DE INSTITUCIÓN</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Colegio San José" className="bg-slate-800 border-slate-700 w-64" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="condoId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-slate-400 ml-1">ID ÚNICO (condoId)</FormLabel>
              <FormControl>
                <Input placeholder="Ej: CSJ-2026" className="bg-slate-800 border-slate-700 w-40" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-slate-400 ml-1">URL DEL LOGO (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." className="bg-slate-800 border-slate-700 w-64" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 h-10 px-6">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          {isSubmitting ? 'CREANDO...' : 'REGISTRAR'}
        </Button>
      </form>
    </Form>
  );
}
