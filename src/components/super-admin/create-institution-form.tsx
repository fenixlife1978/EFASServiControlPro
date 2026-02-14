'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});

export function CreateInstitutionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore no está disponible.' });
      return;
    }
    setIsSubmitting(true);
    
    try {
        const institutionsRef = collection(firestore, 'institutions');
        await addDocumentNonBlocking(institutionsRef, {
            nombre: values.nombre,
            direccion: '',
            logoUrl: '',
            modoFiltro: 'Blacklist', // Default value
            superAdminSuspended: false, // Default value
            createdAt: serverTimestamp(),
        });

        toast({ title: 'Éxito', description: `La institución "${values.nombre}" ha sido creada.` });
        form.reset(); // Reset form after successful submission
    } catch (error) {
        console.error('Error creating institution: ', error);
        toast({ variant: 'destructive', title: 'Error en Firestore', description: 'No se pudo crear la institución.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-4 items-center">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input placeholder="Nombre de la Institución Educativa..." 
                       className="w-full bg-black/40 border border-slate-700 p-3 h-12 rounded-lg outline-none focus:border-blue-500 transition-all font-bold text-base" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 py-3 rounded-lg font-black uppercase tracking-tighter shadow-lg shadow-blue-900/20" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear Institución'}
        </Button>
      </form>
    </Form>
  );
}
