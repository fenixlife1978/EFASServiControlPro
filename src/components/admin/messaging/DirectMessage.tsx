'use client';
import React, { useState } from 'react';
import { db } from '@/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Send, MessageSquare, X, AlertCircle } from 'lucide-react';

interface MessageProps {
  deviceId: string;
  alumnoNombre: string;
  userRole: string; // 'super-admin' | 'director' | 'profesor'
  onClose: () => void;
}

export default function DirectMessage({ deviceId, alumnoNombre, userRole, onClose }: MessageProps) {
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);

  // Verificación estricta de rol
  const canSendMessage = userRole === 'super-admin' || userRole === 'director';

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSendMessage || !mensaje.trim()) return;

    setSending(true);
    try {
      await updateDoc(doc(db, "dispositivos", deviceId), {
        mensaje_alerta: mensaje.trim(),
        mensaje_timestamp: serverTimestamp(),
        mensaje_remitente: userRole.toUpperCase()
      });
      setMensaje('');
      onClose();
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-8 flex items-center justify-between">
          <div className="flex items-center gap-4 text-white">
            <MessageSquare className="w-6 h-6 text-orange-500" />
            <div>
              <h2 className="text-xl font-black italic uppercase leading-none">Mensaje Directo</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Para: {alumnoNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          {!canSendMessage ? (
            <div className="bg-red-50 p-6 rounded-2xl flex flex-col items-center text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
              <p className="text-xs font-black uppercase italic text-red-600">Acceso Restringido</p>
              <p className="text-[10px] text-red-400 font-bold uppercase mt-1">Solo Super Admin o Directores pueden enviar alertas.</p>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea 
                autoFocus
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe la instrucción para el estudiante..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 font-bold text-slate-900 focus:border-orange-500 outline-none h-32 resize-none italic text-sm"
              />
              <button 
                type="submit" 
                disabled={sending || !mensaje.trim()}
                className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black uppercase italic text-xs shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {sending ? "Enviando..." : <><Send className="w-4 h-4" /> Enviar Alerta</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
