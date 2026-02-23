'use client';
import React, { useState } from 'react';

export const DatabaseSelector = () => {
  const [serverUrl, setServerUrl] = useState('http://localhost:5000');
  const [showIpInput, setShowIpInput] = useState(false);

  const saveConfig = (mode: 'cloud' | 'local' | 'hybrid', url?: string) => {
    localStorage.setItem('edu_db_mode', mode);
    if (url) localStorage.setItem('edu_local_url', url);
    window.location.reload();
  };

  return (
    <div style={{ 
      padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', 
      backgroundColor: '#f0f2f5', minHeight: '100vh', display: 'flex',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#1a73e8' }}>Configuración de Conexión EDUControlPro</h2>
        <p style={{ color: '#5f6368' }}>Seleccione cómo desea conectar su base de datos:</p>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '30px' }}>
          <button onClick={() => saveConfig('cloud')} style={{ padding: '20px', cursor: 'pointer', width: '180px', borderRadius: '10px', border: '1px solid #dadce0', backgroundColor: 'white' }}>
            <strong>☁️ Solo Nube</strong><br/><span style={{ fontSize: '12px' }}>Firebase Online</span>
          </button>
          <button onClick={() => setShowIpInput(true)} style={{ padding: '20px', cursor: 'pointer', width: '180px', borderRadius: '10px', border: '1px solid #dadce0', backgroundColor: 'white' }}>
            <strong>🖥️ Servidor Local</strong><br/><span style={{ fontSize: '12px' }}>Escuela (Físico)</span>
          </button>
          <button onClick={() => { setShowIpInput(true); localStorage.setItem('edu_db_mode', 'hybrid'); }} style={{ padding: '20px', cursor: 'pointer', width: '180px', borderRadius: '10px', border: '1px solid #dadce0', backgroundColor: 'white' }}>
            <strong>⚡ Modo Híbrido</strong><br/><span style={{ fontSize: '12px' }}>Nube + Local</span>
          </button>
        </div>
        {showIpInput && (
          <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <p style={{ fontWeight: 'bold' }}>Dirección IP del Servidor:</p>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="Ej: http://192.168.1.50:5000" style={{ padding: '12px', width: '280px', borderRadius: '5px', border: '1px solid #ccc' }} />
            <button onClick={() => saveConfig(localStorage.getItem('edu_db_mode') as any || 'local', serverUrl)} style={{ marginLeft: '10px', padding: '12px 25px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Conectar Ahora</button>
          </div>
        )}
      </div>
    </div>
  );
};
