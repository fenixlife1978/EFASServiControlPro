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
import { Loader2, UserCog, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { db, rtdb } from '@/firebase/config';
import { 
  doc, 
  updateDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { ref, update } from 'firebase/database';
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
        defaultValues: {
            nombre_alumno: '',
        }
    });
    
    useEffect(() => {
        if (student && isOpen) {
            const currentName = student.nombre || student.nombre_alumno || student.alumno_asignado || '';
            form.reset({ nombre_alumno: currentName });
            
            const buscarDeviceId = async () => {
                // Buscar por deviceId directo
                let foundDeviceId = student.deviceId || null;
                
                // Si no, buscar por ID del alumno como deviceId
                if (!foundDeviceId && student.id) {
                    try {
                        const deviceDoc = await getDoc(doc(db, "dispositivos", student.id));
                        if (deviceDoc.exists()) {
                            foundDeviceId = student.id;
                        }
                    } catch (e) {
                        console.error("Error buscando hardware por ID:", e);
                    }
                }
                
                // Si aún no hay, buscar en la colección dispositivos por alumno_asignado
                if (!foundDeviceId && student.nombre) {
                    try {
                        const devicesRef = collection(db, "dispositivos");
                        const q = query(devicesRef, where("alumno_asignado", "==", student.nombre));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            foundDeviceId = querySnapshot.docs[0].id;
                        }
                    } catch (e) {
                        console.error("Error buscando dispositivo por alumno:", e);
                    }
                }
                
                setDeviceId(foundDeviceId);
            };
            
            buscarDeviceId();
        }
    }, [student, isOpen, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!student?.id) {
            toast({ variant: 'destructive', title: 'Error de Identidad', description: 'No se detectó el ID del alumno.' });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const batchPromises = [];
            const timestamp = Date.now();
            const nombreFormateado = values.nombre_alumno.toUpperCase().trim();
            
            // 1. Actualización en Firestore - Usuarios
            const userRef = doc(db, "usuarios", student.id);
            batchPromises.push(updateDoc(userRef, {
                nombre: nombreFormateado,
                nombre_alumno: nombreFormateado,
                updatedAt: new Date()
            }));
            
            // 2. Si hay dispositivo vinculado, actualizar en Firestore y RTDB
            if (deviceId) {
                // Firestore
                const deviceRef = doc(db, "dispositivos", deviceId);
                batchPromises.push(updateDoc(deviceRef, {
                    alumno_asignado: nombreFormateado,
                    lastUpdated: new Date()
                }));
                
                // RTDB (para sincronización en tiempo real con MonitorService)
                const rtdbDeviceRef = ref(rtdb, `dispositivos/${deviceId}`);
                batchPromises.push(update(rtdbDeviceRef, {
                    alumno_asignado: nombreFormateado,
                    lastUpdated: timestamp,
                    ultimoAcceso: timestamp
                }));
                
                // También actualizar en status_dispositivos para monitoreo
                const rtdbStatusRef = ref(rtdb, `status_dispositivos/${deviceId}`);
                batchPromises.push(update(rtdbStatusRef, {
                    alumno_asignado: nombreFormateado,
                    lastUpdated: timestamp
                }));
            }
            
            await Promise.all(batchPromises);

            toast({ 
                title: 'SINCRONIZACIÓN EXITOSA', 
                description: `El perfil de "${nombreFormateado}" ha sido actualizado en la red (Firestore + RTDB).` 
            });
            
            onOpenChange(false);
            
        } catch (error) {
            console.error("EDUControlPro Sync Error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'FALLO DE RED', 
                description: 'No se pudieron sincronizar los cambios con el servidor.' 
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!student) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#0f1117] border border-white/5 rounded-[2.5rem] p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] outline-none">
                <DialogHeader className="mb-6">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                            <UserCog className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">
                                Gestión de <span className="text-orange-500">Perfil</span>
                            </DialogTitle>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Sincronización MDM Activa</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <Badge className="bg-slate-900 text-[9px] font-black uppercase tracking-widest border border-white/5 px-3 py-1">
                            EQUIPO: {student.nro_equipo || student.deviceId?.slice(-6) || 'S/N'}
                        </Badge>
                        <Badge className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest border-none px-3 py-1">
                            REF: {student.id?.slice(-6).toUpperCase()}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-8">
                    {/* Panel de Ubicación Operativa */}
                    <div className="grid grid-cols-2 gap-4 bg-white/[0.02] p-5 rounded-3xl border border-white/5">
                        <div className="space-y-1.5">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                <div className="w-1 h-1 bg-slate-600 rounded-full" /> Institución
                            </p>
                            <p className="text-[10px] font-bold text-slate-300 truncate uppercase italic leading-none">{institutionId}</p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                <div className="w-1 h-1 bg-slate-600 rounded-full" /> Aula / Sección
                            </p>
                            <p className="text-[10px] font-bold text-slate-300 truncate uppercase italic leading-none">{classroomId}</p>
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <FormField
                                control={form.control}
                                name="nombre_alumno"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <div className="flex justify-between items-end px-1">
                                            <FormLabel className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                Nombre del Estudiante
                                            </FormLabel>
                                            <Badge variant="outline" className="text-[8px] border-slate-800 text-slate-600 font-bold uppercase py-0 px-2 h-4">Requerido</Badge>
                                        </div>
                                        <FormControl>
                                            <Input 
                                                placeholder="EJ: MARCOS DÍAZ" 
                                                {...field} 
                                                className="bg-slate-950/50 border-white/5 text-white rounded-2xl h-14 font-black focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all uppercase px-5 placeholder:text-slate-800"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[9px] font-black text-red-500 uppercase tracking-tight italic" />
                                    </FormItem>
                                )}
                            />

                            {deviceId ? (
                                <div className="flex items-center justify-between px-5 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Hardware Asegurado</span>
                                            <span className="text-[8px] font-mono text-emerald-500/50">{deviceId.slice(-12)}</span>
                                        </div>
                                    </div>
                                    <MonitorSmartphone className="w-4 h-4 text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors" />
                                </div>
                            ) : (
                                <div className="px-5 py-3 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
                                    <span className="text-[9px] font-black text-slate-600 uppercase italic">Sin terminal MDM vinculado</span>
                                </div>
                            )}
                            
                            <DialogFooter className="gap-3 sm:gap-4 pt-4 border-t border-white/5">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => onOpenChange(false)} 
                                    disabled={isSubmitting} 
                                    className="flex-1 h-14 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:bg-white/5 hover:text-white transition-all"
                                >
                                    Cancelar
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={isSubmitting} 
                                    className="flex-1 h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase shadow-[0_10px_20px_-10px_rgba(249,115,22,0.5)] transition-all active:scale-95"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        'Aplicar Cambios'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}