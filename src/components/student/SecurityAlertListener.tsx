'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, limit, getDoc } from 'firebase/firestore';
import { ShieldAlert, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SecurityAlertListenerProps {
  institutionId: string;
  deviceId: string; // Cambiado de studentId a deviceId para que coincida con la estructura real
}

export function SecurityAlertListener({ institutionId, deviceId }: SecurityAlertListenerProps) {
  const [activeAlert, setActiveAlert] = useState<any>(null);

  useEffect(() => {
    if (!institutionId || !deviceId) return;

    // 🔥 CORREGIDO: Escuchar directamente el documento del dispositivo
    const deviceRef = doc(db, 'dispositivos', deviceId);
    
    const unsubscribe = onSnapshot(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Verificar si hay un mensaje pendiente
        if (data.pending_message && !data.message_viewed) {
          setActiveAlert({
            id: snapshot.id,
            mensaje: data.pending_message,
            timestamp: data.message_timestamp,
            sender: data.message_sender
          });
        } else {
          setActiveAlert(null);
        }
      } else {
        setActiveAlert(null);
      }
    }, (error) => {
      console.error("Error escuchando mensajes:", error);
    });

    return () => unsubscribe();
  }, [institutionId, deviceId]);

  const markAsRead = async () => {
    if (!activeAlert) return;
    
    try {
      const deviceRef = doc(db, 'dispositivos', deviceId);
      await updateDoc(deviceRef, { 
        message_viewed: true,
        message_readAt: new Date()
      });
      setActiveAlert(null);
    } catch (error) {
      console.error("Error al confirmar lectura:", error);
    }
  };

  if (!activeAlert) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
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
            <p className="text-xs text-slate-500 mt-2 italic">
              Remitente: {activeAlert.sender}
            </p>
          )}
        </div>

        <div className="pt-4">
          <Button 
            onClick={markAsRead}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black italic rounded-2xl py-8 uppercase text-lg shadow-lg active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-6 h-6 mr-2" /> ENTENDIDO / CONFIRMAR
          </Button>
          <p className="text-[10px] text-slate-600 font-bold uppercase mt-4 tracking-widest">
            Este mensaje ha sido registrado en su expediente.
          </p>
        </div>

      </div>
    </div>
  );
}