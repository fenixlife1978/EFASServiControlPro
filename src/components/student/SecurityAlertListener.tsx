'use client';

import React, { useEffect, useState } from 'react';
import { db, rtdb } from '@/firebase/config';
import { updateDoc, doc } from 'firebase/firestore';
import { ref, onValue, set, update } from 'firebase/database';
import { ShieldAlert, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SecurityAlertListenerProps {
  institutionId: string;
  deviceId: string;
}

interface MensajeActual {
  mensaje: string;
  remitente: string;
  messageId: string;
  timestamp: number;
  leido: boolean;
}

export function SecurityAlertListener({ institutionId, deviceId }: SecurityAlertListenerProps) {
  const [activeAlert, setActiveAlert] = useState<MensajeActual | null>(null);

  useEffect(() => {
    if (!institutionId || !deviceId) return;

    // Escuchar mensaje actual (misma ruta que usa MessageActivity)
    const mensajeRef = ref(rtdb, `dispositivos/${deviceId}/mensaje_actual`);

    const unsubscribe = onValue(mensajeRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Si el mensaje no ha sido leído, mostrar alerta
        if (data.mensaje && data.leido !== true) {
          setActiveAlert({
            mensaje: data.mensaje,
            remitente: data.remitente || 'Dirección',
            messageId: data.messageId || Date.now().toString(),
            timestamp: data.timestamp || Date.now(),
            leido: data.leido || false
          });
        } else {
          setActiveAlert(null);
        }
      } else {
        setActiveAlert(null);
      }
    });

    return () => unsubscribe();
  }, [institutionId, deviceId]);

  const markAsRead = async () => {
    if (!activeAlert) return;
    
    try {
      // 1. Marcar como leído en RTDB (misma ruta que MessageActivity)
      const mensajeRef = ref(rtdb, `dispositivos/${deviceId}/mensaje_actual`);
      await update(mensajeRef, { 
        leido: true,
        leido_en: Date.now()
      });

      // 2. También guardar en historial de mensajes leídos
      const historialRef = ref(rtdb, `dispositivos/${deviceId}/mensajes_leidos/${activeAlert.messageId}`);
      await set(historialRef, {
        mensaje: activeAlert.mensaje,
        remitente: activeAlert.remitente,
        leido_en: Date.now(),
        timestamp: activeAlert.timestamp
      });

      // 3. Opcional: persistir en Firestore para auditoría
      const deviceRef = doc(db, 'dispositivos', deviceId);
      await updateDoc(deviceRef, { 
        last_message_viewed: true,
        last_message_readAt: new Date(),
        ultimo_mensaje_leido: activeAlert.messageId
      });

      setActiveAlert(null);
    } catch (error) {
      console.error("Error al confirmar lectura en EDUControlPro:", error);
    }
  };

  if (!activeAlert) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-[#11141d] border-2 border-orange-500 rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(249,115,22,0.3)] text-center space-y-6">
        
        <div className="flex justify-center">
          <div className="bg-orange-500/20 p-5 rounded-full animate-bounce">
            <ShieldAlert className="w-12 h-12 text-orange-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">
            Notificación de <span className="text-orange-500">Dirección</span>
          </h2>
          <div className="h-1 w-20 bg-orange-500 mx-auto rounded-full" />
        </div>

        <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
          <MessageSquare className="w-5 h-5 text-slate-500 mb-2 mx-auto" />
          <p className="text-lg text-slate-200 font-medium leading-relaxed">
            "{activeAlert.mensaje}"
          </p>
          {activeAlert.remitente && (
            <p className="text-xs text-slate-500 mt-2 italic uppercase font-bold tracking-widest">
              Remitente: {activeAlert.remitente}
            </p>
          )}
        </div>

        <div className="pt-4">
          <Button 
            onClick={markAsRead}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black italic rounded-2xl py-8 uppercase text-lg shadow-lg active:scale-95 transition-all border-b-4 border-orange-800"
          >
            <CheckCircle2 className="w-6 h-6 mr-2" /> ENTENDIDO / CONFIRMAR
          </Button>
          <p className="text-[10px] text-slate-600 font-black uppercase mt-4 tracking-widest italic">
            EDUControlPro - Registro de Seguridad Estudiantil
          </p>
        </div>

      </div>
    </div>
  );
}