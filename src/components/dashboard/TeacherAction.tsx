'use client';
import { db } from '@/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { Snowflake, Play, Lock, GlobeLock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

export const TeacherAction = ({ deviceId, isFrozen, deviceStatus }: { 
  deviceId: string, 
  isFrozen?: boolean,
  deviceStatus?: any 
}) => {
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');

  // Modo Congelar -> Usamos 'shieldMode' (blindaje extremo)
  const toggleFreeze = async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "dispositivos", deviceId), {
        shieldMode: !isFrozen,
        // También podemos disparar bloqueo inmediato al congelar
        bloquear: !isFrozen ? true : false
      });
      
      // Resetear el comando bloquear después de 2 segundos
      if (!isFrozen) {
        setTimeout(async () => {
          await updateDoc(doc(db, "dispositivos", deviceId), {
            bloquear: false
          });
        }, 2000);
      }
      
    } catch (e) {
      console.error("Error al cambiar estado:", e);
    }
    setLoading(false);
  };

  // Bloqueo inmediato individual
  const bloquearAhora = async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "dispositivos", deviceId), {
        bloquear: true,
        bloqueo_timestamp: new Date().toISOString()
      });
      
      setTimeout(async () => {
        await updateDoc(doc(db, "dispositivos", deviceId), {
          bloquear: false
        });
      }, 2000);
    } catch (e) {
      console.error("Error al bloquear:", e);
    }
    setLoading(false);
  };

  // Cambiar PIN individual
  const cambiarPin = async () => {
    if (!deviceId || pinValue.length !== 4) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "dispositivos", deviceId), {
        pinBloqueo: pinValue
      });
      setShowPinModal(false);
      setPinValue('');
    } catch (e) {
      console.error("Error al cambiar PIN:", e);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Botón Congelar/Descongelar */}
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

      {/* Botón Bloqueo Inmediato */}
      <button 
        onClick={bloquearAhora}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase italic transition-all"
      >
        <Lock size={14} />
        Bloquear Ahora
      </button>

      {/* Botón Cambiar PIN */}
      <button 
        onClick={() => setShowPinModal(true)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[10px] font-black uppercase italic transition-all"
      >
        <ShieldAlert size={14} />
        Cambiar PIN
      </button>

      {/* Modal para PIN */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1117] border border-slate-800 rounded-3xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-black italic uppercase text-white mb-4">Nuevo PIN</h3>
            <input
              type="password"
              maxLength={4}
              className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl text-center text-2xl tracking-[0.5em] font-bold text-white outline-none focus:border-orange-500"
              placeholder="••••"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/[^0-9]/g, '').slice(0,4))}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={cambiarPin}
                disabled={pinValue.length !== 4}
                className="bg-orange-500 disabled:bg-slate-800 text-white font-black py-3 rounded-xl text-[10px] uppercase"
              >
                Guardar
              </button>
              <button
                onClick={() => setShowPinModal(false)}
                className="bg-slate-800 text-white font-black py-3 rounded-xl text-[10px] uppercase"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
