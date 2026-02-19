'use client';
import { db } from '@/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { Snowflake, Play } from 'lucide-react';
import { useState } from 'react';

export const TeacherAction = ({ deviceId, isFrozen }: { deviceId: string, isFrozen: boolean }) => {
  const [loading, setLoading] = useState(false);

  const toggleFreeze = async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "dispositivos", deviceId), {
        is_frozen: !isFrozen
      });
    } catch (e) {
      console.error("Error al cambiar estado de congelado:", e);
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={toggleFreeze}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${
        isFrozen 
        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
        : 'bg-slate-800 text-slate-400 hover:bg-blue-500/20 hover:text-blue-400'
      }`}
    >
      {isFrozen ? <Play size={14} /> : <Snowflake size={14} />}
      {isFrozen ? 'Desbloquear Pantalla' : 'Congelar Pantalla'}
    </button>
  );
};
