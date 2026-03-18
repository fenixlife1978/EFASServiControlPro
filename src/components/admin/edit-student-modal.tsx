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
import { Loader2, UserCog, MonitorSmartphone } from 'lucide-react';
import { db } from '@/firebase/config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Badge } from '../ui/badge';

interface EditStudentModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    student: any | null; 
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
    
    useEffect(() => {
        if (student) {
            form.reset({ nombre_alumno: student.nombre || student.nombre_alumno || '' });
            
            const buscarDeviceId = async () => {
                if (!student.deviceId && student.id) {
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
            // 1. Actualizar en "usuarios" (Core del sistema)
            const userRef = doc(db, "usuarios", student.id);
            await updateDoc(userRef, {
                nombre: values.nombre_alumno,
                nombre_alumno: values.nombre_alumno,
                updatedAt: new Date()
            });
            
            // 2. Sincronizar con "dispositivos" si existe vinculación activa
            if (deviceId) {
                const deviceRef = doc(db, "dispositivos", deviceId);
                await updateDoc(deviceRef, {
                    alumno_asignado: values.nombre_alumno,
                    lastUpdated: new Date()
                });
            }
            
            toast({ 
                title: 'PERFIL ACTUALIZADO', 
                description: `EDUControlPro ha registrado a "${values.nombre_alumno}".` 
            });
            
            onOpenChange(false);
            
        } catch (error) {
            console.error("Error EDUControlPro Update:", error);
            toast({ 
                variant: 'destructive', 
                title: 'ERROR DE SISTEMA', 
                description: 'No se pudo completar la reasignación.' 
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!student) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#0f1117] border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
                <DialogHeader className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-500 rounded-xl">
                            <UserCog className="w-5 h-5 text-white" />
                        </div>
                        <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tighter">
                            Editar <span className="text-orange-500">Estudiante</span>
                        </DialogTitle>
                    </div>
                    <div className="flex gap-2">
                         <Badge className="bg-slate-800 text-[9px] font-black uppercase tracking-widest border-none">
                            EQ: {student.nro_equipo || 'S/N'}
                        </Badge>
                        <Badge className="bg-orange-500/10 text-orange-500 text-[9px] font-black uppercase tracking-widest border-none">
                            ID: {student.id?.slice(-6).toUpperCase()}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Información de Contexto */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Institución</p>
                            <p className="text-[10px] font-bold text-slate-200 truncate uppercase italic">{institutionId}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Aula Asignada</p>
                            <p className="text-[10px] font-bold text-slate-200 truncate uppercase italic">{classroomId}</p>
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="nombre_alumno"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Nombre Completo del Alumno
                                        </FormLabel>
                                        <FormControl>
                                            <Input 
                                                placeholder="EJ: MARCOS DÍAZ" 
                                                {...field} 
                                                className="bg-slate-950 border-slate-800 text-white rounded-xl h-12 font-bold focus:ring-orange-500/20 uppercase"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold text-red-500 uppercase" />
                                    </FormItem>
                                )}
                            />

                            {deviceId && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/5 border border-green-500/10 rounded-xl">
                                    <MonitorSmartphone className="w-3 h-3 text-green-500" />
                                    <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter">
                                        Hardware vinculado: {deviceId}
                                    </span>
                                </div>
                            )}
                            
                            <DialogFooter className="gap-3 sm:gap-0 pt-2">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => onOpenChange(false)} 
                                    disabled={isSubmitting} 
                                    className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-800/50"
                                >
                                    Cerrar
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={isSubmitting} 
                                    className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase shadow-lg shadow-orange-500/20 transition-all"
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Sincronizar Cambios
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}