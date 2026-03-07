'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { db } from '@/firebase/config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Badge } from '../ui/badge';

interface EditStudentModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    student: any | null; // Alumno de la colección "usuarios"
    institutionId: string;
    classroomId: string;
}

const formSchema = z.object({
  nombre_alumno: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});

export function EditStudentModal({ isOpen, onOpenChange, student, institutionId, classroomId }: EditStudentModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const { toast } = useToast();
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });
    
    // Cargar datos iniciales
    useEffect(() => {
        if (student) {
            form.reset({ nombre_alumno: student.nombre || student.nombre_alumno || '' });
            
            // Buscar el deviceId asociado
            const buscarDeviceId = async () => {
                if (!student.deviceId && student.id) {
                    // Intentar buscar en dispositivos por este usuario
                    const deviceQuery = await getDoc(doc(db, "dispositivos", student.id));
                    if (deviceQuery.exists()) {
                        setDeviceId(student.id);
                    }
                } else {
                    setDeviceId(student.deviceId || null);
                }
            };
            
            buscarDeviceId();
        }
    }, [student, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!student || !student.id) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al alumno.' });
            return;
        }

        setIsSubmitting(true);
        
        try {
            // 1. Actualizar en colección "usuarios"
            const userRef = doc(db, "usuarios", student.id);
            await updateDoc(userRef, {
                nombre: values.nombre_alumno,
                nombre_alumno: values.nombre_alumno,
                updatedAt: new Date()
            });
            
            // 2. Si hay deviceId asociado, actualizar también en "dispositivos"
            if (deviceId) {
                const deviceRef = doc(db, "dispositivos", deviceId);
                await updateDoc(deviceRef, {
                    alumno_asignado: values.nombre_alumno,
                    lastUpdated: new Date()
                });
            }
            
            toast({ 
                title: '✅ Alumno actualizado', 
                description: `El nombre se ha cambiado a "${values.nombre_alumno}".` 
            });
            
            onOpenChange(false);
            
        } catch (error) {
            console.error("Error actualizando alumno:", error);
            toast({ 
                variant: 'destructive', 
                title: '❌ Error', 
                description: 'No se pudo actualizar el alumno.' 
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!student) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#0f1117] border border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <Badge variant="default" className="bg-orange-500">EQUIPO #{student.nro_equipo || student.id?.slice(-4) || 'N/A'}</Badge>
                        <span className="text-white">Reasignar Alumno</span>
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-2">
                            <p><strong className="text-orange-500">Institución:</strong> <span className="font-mono">{institutionId}</span></p>
                            <p><strong className="text-orange-500">Aula:</strong> <span className="font-mono">{classroomId}</span></p>
                            <p><strong className="text-orange-500">Usuario ID:</strong> <span className="font-mono">{student.id}</span></p>
                            {deviceId && (
                                <p><strong className="text-orange-500">Dispositivo:</strong> <span className="font-mono">{deviceId}</span></p>
                            )}
                        </div>
                        
                        <FormField
                            control={form.control}
                            name="nombre_alumno"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-slate-300">Nombre Completo del Alumno</FormLabel>
                                    <FormControl>
                                        <Input 
                                            placeholder="Ej: Juan Pérez" 
                                            {...field} 
                                            className="bg-slate-900 border-slate-700 text-white"
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-400" />
                                </FormItem>
                            )}
                        />
                        
                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => onOpenChange(false)} 
                                disabled={isSubmitting} 
                                className="w-full sm:w-auto border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting} 
                                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
                            >
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
