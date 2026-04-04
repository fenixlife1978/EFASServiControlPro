'use client';
import { useState } from 'react';
import { db, rtdb } from '@/firebase/config'; // Importamos rtdb
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, update, serverTimestamp as rtdbTimestamp } from 'firebase/database'; // Métodos RTDB
import { useToast } from '@/hooks/use-toast';
import { X, UserPlus } from 'lucide-react';

interface Props {
  deviceId: string;
  InstitutoId: string;
  aulaId: string;
  seccion: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AssignStudentModal({ deviceId, InstitutoId, aulaId, seccion, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId || !name.trim()) return;

    setLoading(true);

    try {
      // 1. Generar ID único para el usuario
      const baseName = name.toLowerCase().trim().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const suffix = deviceId.slice(-4);
      const customId = `${baseName}_${suffix}`;

      // 2. Crear el usuario en Firestore (Colección Usuarios)
      const userRef = doc(db, "usuarios", customId);
      await setDoc(userRef, {
        nombre: name.trim(),
        rol: "alumno",
        InstitutoId: InstitutoId,
        aulaId: aulaId,
        seccion: seccion,
        deviceId: deviceId,
        id: customId,
        status: 'active',
        createdAt: serverTimestamp()
      });

      // 3. Actualizar Dispositivo en Firestore (Metadatos persistentes)
      const deviceRef = doc(db, "dispositivos", deviceId);
      await updateDoc(deviceRef, {
        alumno_asignado: name.trim(),
        status: 'active',
        vinculado: true,
        lastUpdated: serverTimestamp()
      });

      // 4. MIGRACIÓN A RTDB: Reflejar vinculación para monitoreo en tiempo real
      const rtdbRef = ref(rtdb, `dispositivos/${deviceId}`);
      await update(rtdbRef, {
        alumno_asignado: name.trim(),
        status: 'active',
        vinculado: true,
        InstitutoId: InstitutoId,
        aulaId: aulaId,
        seccion: seccion,
        rol: "alumno", // Importante para el filtrado en ProfesorView
        lastUpdated: rtdbTimestamp()
      });

      toast({ 
        title: '✅ Vinculación Exitosa', 
        description: `El alumno ${name} ha sido asignado al dispositivo ${deviceId}.` 
      });
      
      if (onSuccess) onSuccess();
      onClose();
      
    } catch (error) {
      console.error("Error al asignar alumno:", error);
      toast({ 
        variant: 'destructive', 
        title: '❌ Error', 
        description: 'No se pudo completar la asignación.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4">
      <div className="bg-[#0f1117] rounded-[2.5rem] p-8 w-full max-w-md border border-slate-800 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Vincular Estudiante</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-wider mt-1">
            Asignar identidad al dispositivo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1">
              Nombre y Apellido del Alumno
            </label>
            <input 
              autoFocus
              required
              className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all font-bold text-white placeholder:text-slate-700"
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[8px] font-black text-slate-500 uppercase">Dispositivo</p>
              <p className="text-sm font-mono font-black text-orange-500">{deviceId}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/50">
              <div>
                <p className="text-[8px] font-black text-slate-500 uppercase">Aula</p>
                <p className="text-xs font-bold text-white uppercase italic">{aulaId}</p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-500 uppercase">Sección</p>
                <p className="text-xs font-bold text-white uppercase italic">{seccion}</p>
              </div>
            </div>
          </div>

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-orange-500/20 transition-all disabled:opacity-50"
          >
            {loading ? 'PROCESANDO...' : 'FINALIZAR VINCULACIÓN'}
          </button>
          
          <button 
            type="button" 
            onClick={onClose} 
            className="w-full text-slate-500 text-[10px] font-black uppercase py-2 hover:text-white transition-colors"
          >
            Cancelar operación
          </button>
        </form>
      </div>
    </div>
  );
}
