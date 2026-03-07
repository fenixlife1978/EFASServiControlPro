'use client';
import React, { useState, useEffect } from 'react';
import { setDbMode, getDbMode, getLocalServerUrl } from '@/firebase/config';
import { dbService } from '@/lib/dbService';  // ← SOLO ESTO CAMBIÓ

export const DatabaseSelector = () => {
  const [serverUrl, setServerUrl] = useState('http://localhost:5000');
  const [showIpInput, setShowIpInput] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'cloud' | 'local' | 'hybrid' | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Cargar configuración actual al iniciar
  useEffect(() => {
    setServerUrl(getLocalServerUrl());
  }, []);

  const saveConfig = async (mode: 'cloud' | 'local' | 'hybrid', url?: string) => {
    // Guardar en localStorage usando dbService
    dbService.saveSettings(mode, url);
    
    // Mostrar mensaje de éxito
    alert(`✅ Modo ${mode} configurado correctamente`);
    
    // Opcional: recargar para aplicar cambios en todos los componentes
    window.location.reload();
  };

  const handleLocalClick = () => {
    setSelectedMode('local');
    setShowIpInput(true);
  };

  const handleHybridClick = () => {
    setSelectedMode('hybrid');
    setShowIpInput(true);
  };

  const handleConnect = () => {
    if (selectedMode) {
      saveConfig(selectedMode, serverUrl);
      setShowIpInput(false);
      setIsOpen(false);
    }
  };

  // Versión flotante
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#f97316',
          color: 'white',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
          fontSize: '20px',
          zIndex: 1000
        }}
      >
        ⚙️
      </button>
    );
  }

  return (
    <div style={{ 
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      backgroundColor: '#0f1117',
      border: '1px solid #1e293b',
      borderRadius: '20px',
      padding: '24px',
      width: '320px',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
      zIndex: 1000,
      color: 'white'
    }}>
      {/* Botón cerrar */}
      <button
        onClick={() => setIsOpen(false)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        ✕
      </button>

      <h3 style={{ 
        color: 'white', 
        fontSize: '14px',
        fontWeight: 'bold',
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        ⚙️ CONEXIÓN DATABASE
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => saveConfig('cloud')}
          style={{ 
            padding: '12px', 
            cursor: 'pointer', 
            borderRadius: '12px', 
            border: '1px solid #1e293b',
            backgroundColor: '#1a1d26',
            color: 'white',
            textAlign: 'left',
            transition: 'all 0.2s'
          }}
        >
          <strong>☁️ Solo Nube</strong><br/>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Firebase Online</span>
        </button>
        
        <button 
          onClick={handleLocalClick}
          style={{ 
            padding: '12px', 
            cursor: 'pointer', 
            borderRadius: '12px', 
            border: '1px solid #1e293b',
            backgroundColor: '#1a1d26',
            color: 'white',
            textAlign: 'left'
          }}
        >
          <strong>🖥️ Servidor Local</strong><br/>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Escuela (Físico)</span>
        </button>
        
        <button 
          onClick={handleHybridClick}
          style={{ 
            padding: '12px', 
            cursor: 'pointer', 
            borderRadius: '12px', 
            border: '1px solid #1e293b',
            backgroundColor: '#1a1d26',
            color: 'white',
            textAlign: 'left'
          }}
        >
          <strong>⚡ Modo Híbrido</strong><br/>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Nube + Local</span>
        </button>
      </div>

      {showIpInput && (
        <div style={{ 
          borderTop: '1px solid #1e293b', 
          paddingTop: '16px' 
        }}>
          <p style={{ 
            fontSize: '11px', 
            color: '#f97316',
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>
            Dirección del Servidor:
          </p>
          <input 
            type="text" 
            value={serverUrl} 
            onChange={(e) => setServerUrl(e.target.value)} 
            placeholder="http://192.168.1.50:5000" 
            style={{ 
              padding: '10px', 
              width: '100%', 
              borderRadius: '8px', 
              border: '1px solid #1e293b',
              backgroundColor: '#0a0c10',
              color: 'white',
              fontSize: '12px',
              marginBottom: '10px'
            }} 
          />
          <button 
            onClick={handleConnect} 
            style={{ 
              width: '100%',
              padding: '12px', 
              backgroundColor: '#f97316', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px',
              textTransform: 'uppercase'
            }}
          >
            Conectar Ahora
          </button>
        </div>
      )}
    </div>
  );
};
