'use client';

import React, { useState } from 'react';
import { addDocumentNonBlocking } from '@/firebase';
import { Send, MessageSquare, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function DirectMessage({ institutionId }: { institutionId: string }) {
  const [message, setMessage] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !targetId) {
        toast({ title: "Atención", description: "Completa todos los campos", variant: "destructive" });
        return;
    }

    setIsSending(true);
    try {
      // Guardamos el mensaje para que el dispositivo del alumno lo detecte
      await addDocumentNonBlocking(`institutions/${institutionId}/mensajes_directos`, {
        targetId: targetId.trim().toUpperCase(),
        mensaje: message,
        remitente: 'DIRECCIÓN',
        prioridad: 'ALTA',
        visto: false,
        timestamp: new Date()
      });

      toast({ title: "ALERTA ENVIADA", description: "El mensaje aparecerá en el dispositivo." });
      setMessage('');
      setTargetId('');
    } catch (error) {
      toast({ variant: "destructive", title: "ERROR DE ENVÍO" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <ShieldAlert className="w-24 h-24 text-orange-500" />
      </div>
      
      <div className="flex items-center gap-3 mb-6 relative">
        <MessageSquare className="text-orange-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white">Mensajería Directa</h2>
      </div>

      <form onSubmit={sendMessage} className="space-y-4 relative">
        <div className="grid grid-cols-1 gap-4">
            <div>
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">ID Estudiante o Dispositivo</label>
                <input 
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full bg-[#1c212c] rounded-2xl py-4 px-4 text-sm font-bold text-orange-500 outline-none focus:ring-2 focus:ring-orange-500 mt-1 border border-white/5"
                    placeholder="EJ: EST-2024"
                />
            </div>

            <div>
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Mensaje de Control</label>
                <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-[#1c212c] rounded-2xl py-4 px-4 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-white mt-1 h-28 resize-none border border-white/5"
                    placeholder="Escriba la advertencia..."
                />
            </div>
        </div>

        <Button 
          disabled={isSending}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black italic rounded-2xl py-7 uppercase shadow-lg shadow-orange-900/20 transition-all active:scale-95"
        >
          <Send className="w-5 h-5 mr-2" /> {isSending ? 'PROCESANDO...' : 'ENVIAR ALERTA INMEDIATA'}
        </Button>
      </form>
    </div>
  );
}