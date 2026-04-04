'use client';
import React, { useState, useEffect } from 'react';

/**
 * Componente de configuración de conexión.
 * Adaptado para soportar el modo Híbrido (Firestore + RTDB).
 */
export const ServerConfig = () => {
  // Inicialización segura del estado
  const [settings, setSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_config');
      return saved ? JSON.parse(saved) : { mode: 'hybrid', url: 'http://localhost:5000' };
    }
    return { mode: 'hybrid', url: '' };
  });

  const handleUpdate = () => {
    if (typeof window !== 'undefined') {
      // Guardamos la configuración que dbService leerá al inicializarse
      localStorage.setItem('app_config', JSON.stringify(settings));
      
      // Marca de completado para el flujo de DatabaseSelector
      localStorage.setItem('setup_completed', 'true');
      
      alert(`✅ Conexión actualizada a modo ${settings.mode.toUpperCase()}`);
      
      // Forzar recarga para que Firebase re-inicialice los listeners según el modo
      window.location.reload();
    }
  };

  return (
    <div className="p-6 bg-[#0f1117] border border-slate-800 rounded-2xl text-white shadow-2xl">
      <h2 className="mb-2 font-black uppercase text-[12px] tracking-widest text-slate-500">
        Configuración de Enlace
      </h2>
      
      <div className="space-y-4 mt-6">
        <div>
          <label className="text-[10px] font-bold text-orange-500 uppercase mb-2 block">
            Modo de Operación
          </label>
          <select 
            className="w-full p-3 bg-[#0a0c10] border border-slate-800 rounded-xl text-sm focus:border-orange-500 outline-none transition-all"
            value={settings.mode}
            onChange={(e) => setSettings({...settings, mode: e.target.value})}
          >
            <option value="hybrid">⚡ Híbrido (Firestore + RTDB)</option>
            <option value="firebase">☁️ Solo Nube (Firestore)</option>
            <option value="local">🏠 Servidor Local (Offline Mode)</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-orange-500 uppercase mb-2 block">
            Endpoint del Servidor
          </label>
          <input 
            type="text" 
            className="w-full p-3 bg-[#0a0c10] border border-slate-800 rounded-xl text-sm focus:border-orange-500 outline-none transition-all"
            placeholder="http://192.168.1.50:5000"
            value={settings.url}
            onChange={(e) => setSettings({...settings, url: e.target.value})}
          />
          <p className="text-[9px] text-slate-500 mt-2 px-1">
            Requerido para el modo Híbrido y Local. Define la IP del servidor de la sede.
          </p>
        </div>

        <button 
          onClick={handleUpdate}
          className="w-full bg-orange-600 p-4 rounded-xl font-black uppercase text-[11px] tracking-tighter hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 mt-4"
        >
          Aplicar y Reiniciar Sistema
        </button>
      </div>
    </div>
  );
};