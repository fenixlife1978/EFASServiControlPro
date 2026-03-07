import React, { useState } from 'react';

export const ServerConfig = () => {
  // 🔥 CORREGIDO: Verificar que window existe antes de leer localStorage
  const [settings, setSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('app_config') || '{"mode":"firebase","url":""}');
    }
    return { mode: 'firebase', url: '' };
  });

  const handleUpdate = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_config', JSON.stringify(settings));
      alert("Configuración guardada. La app usará esta conexión.");
      window.location.reload(); // Recarga para aplicar cambios inmediatamente
    }
  };

  return (
    <div className="p-6 bg-slate-900 rounded-lg text-white">
      <h2 className="mb-4 font-bold">Configuración de Servidor</h2>
      <select 
        className="w-full p-2 bg-slate-800 rounded mb-4"
        value={settings.mode}
        onChange={(e) => setSettings({...settings, mode: e.target.value})}
      >
        <option value="firebase">Firebase</option>
        <option value="local">Servidor Local (IP)</option>
        <option value="custom">Base de Datos Externa (API)</option>
      </select>

      <input 
        type="text" 
        className="w-full p-2 bg-slate-800 rounded mb-4"
        placeholder="URL o IP del servidor"
        value={settings.url}
        onChange={(e) => setSettings({...settings, url: e.target.value})}
      />

      <button 
        onClick={handleUpdate}
        className="w-full bg-orange-600 p-2 rounded font-bold hover:bg-orange-700"
      >
        Actualizar Conexión
      </button>
    </div>
  );
};