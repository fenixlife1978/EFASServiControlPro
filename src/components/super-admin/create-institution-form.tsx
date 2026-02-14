'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';

const formSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres.'),
  InstitutoId: z.string().min(3, 'El ID es obligatorio (ej: CAG-001).'),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

export function CreateInstitutionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nombre: '', InstitutoId: '', logoUrl: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) return;
    setIsSubmitting(true);
    
    try {
        await addDocumentNonBlocking(collection(firestore, 'institutions'), {
            nombre: values.nombre,
            InstitutoId: values.InstitutoId.trim().toUpperCase(), // Reemplazo total de condoId
            logoUrl: values.logoUrl || "",
            status: 'published',
            modoFiltro: 'Blacklist',
            superAdminSuspended: false,
            direccion: '',
            createdAt: serverTimestamp(),
        });

        toast({ title: 'Éxito', description: 'Institución registrada con InstitutoId.' });
        form.reset();
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap gap-4 items-start">
        <FormField control={form.control} name="nombre" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-400 uppercase font-bold">Nombre</FormLabel>
            <FormControl><Input className="bg-slate-800 border-slate-700 w-64 text-white" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="InstitutoId" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-400 uppercase font-bold">InstitutoId</FormLabel>
            <FormControl><Input placeholder="CAG-001" className="bg-slate-800 border-slate-700 w-40 text-orange-400 font-bold" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="logoUrl" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-slate-400 uppercase font-bold">URL Logo</FormLabel>
            <FormControl><Input className="bg-slate-800 border-slate-700 w-64 text-white" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="pt-8">
          <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 h-10 px-6 font-bold">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            REGISTRAR
          </Button>
        </div>
      </form>
    </Form>
  );
}