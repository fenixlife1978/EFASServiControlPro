'use client';

import React, { useEffect, useState } from 'react';
import { db, rtdb } from '@/firebase/config'; // Asegúrate de exportar rtdb desde tu config
import { updateDoc, doc } from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { ShieldAlert, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SecurityAlertListenerProps {
  institutionId: string;
  deviceId: string;
}

export function SecurityAlertListener({ institutionId, deviceId }: SecurityAlertListenerProps) {
  const [activeAlert, setActiveAlert] = useState<any>(null);

  useEffect(() => {
    if (!institutionId || !deviceId) return;

    // ⚡ MIGRACIÓN A REALTIME DATABASE (Capa de Comando Inmediato)
    // Escuchamos el nodo específico del dispositivo para mensajes urgentes
    const messageRef = ref(rtdb, `comandos/${deviceId}/mensaje_urgente`);

    const unsubscribe = onValue(messageRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Si el mensaje no ha sido marcado como visto en RTDB
        if (data.active === true) {
          setActiveAlert({
            mensaje: data.texto,
            timestamp: data.timestamp,
            sender: data.sender || 'Dirección',
            msgId: data.msgId // ID para rastrear en Firestore
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
      // 1. Desactivar en Realtime Database para que desaparezca la UI de inmediato
      const messageRef = ref(rtdb, `comandos/${deviceId}/mensaje_urgente`);
      await set(messageRef, null); 

      // 2. Persistir el acuse de recibo en Firestore (Capa de Auditoría de EDUControlPro)
      // Esto asegura que el profesor vea en su panel que el alumno leyó el mensaje
      const deviceRef = doc(db, 'dispositivos', deviceId);
      await updateDoc(deviceRef, { 
        last_message_viewed: true,
        last_message_readAt: new Date(),
        // Opcional: registrar en una subcolección de logs si lo prefieres
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
          {activeAlert.sender && (
            <p className="text-xs text-slate-500 mt-2 italic uppercase font-bold tracking-widest">
              Remitente: {activeAlert.sender}
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