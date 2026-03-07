'use client';
import React, { useState, useEffect } from 'react';
import { setDbMode, getDbMode, getLocalServerUrl } from '@/firebase/config';
import { dbService } from '@/lib/dbService';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export const DatabaseSelector = () => {
  const [serverUrl, setServerUrl] = useState('http://localhost:5000');
  const [showIpInput, setShowIpInput] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'cloud' | 'local' | 'hybrid' | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(true);
  const { user, userData } = useAuth();
  const router = useRouter();

  // Detectar si es primera ejecución (no hay configuración guardada)
  useEffect(() => {
    // Verificar tanto la configuración como la bandera de completado
    const config = localStorage.getItem('app_config');
    const setupCompleted = localStorage.getItem('setup_completed');
    
    if (config || setupCompleted) {
      setIsFirstRun(false);
    } else {
      setIsFirstRun(true);
    }
  }, []);

  // Cargar configuración actual al iniciar
  useEffect(() => {
    setServerUrl(getLocalServerUrl());
  }, []);

  const saveConfig = (mode: 'cloud' | 'local' | 'hybrid', url?: string) => {
    // Validar: modo híbrido requiere URL
    if (mode === 'hybrid' && !url) {
      alert('❌ Modo híbrido requiere una URL de servidor');
      return;
    }

    // Guardar en localStorage usando dbService
    dbService.saveSettings(mode, url);
    
    // Marcar como configurado (persistente entre sesiones)
    localStorage.setItem('setup_completed', 'true');
    
    // Mostrar mensaje de éxito
    alert(`✅ Modo ${mode} configurado correctamente`);
    
    // 🔥 FLUJO CORREGIDO: Ir directamente al dashboard (no al login)
    window.location.href = '/dashboard';
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

  // REGLAS DE VISIBILIDAD:
  // - Si es primera ejecución → MOSTRAR SIEMPRE (pantalla completa)
  // - Si hay usuario y es super-admin → MOSTRAR (botón flotante)
  // - Si hay usuario y otro rol → NO MOSTRAR
  const shouldShow = isFirstRun || (user && userData?.role === 'super-admin');

  if (!shouldShow) return null;

  // PANTALLA COMPLETA PARA PRIMERA INSTALACIÓN
  if (isFirstRun) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0a0c10',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: '#0f1117',
          border: '1px solid #1e293b',
          borderRadius: '24px',
          padding: '32px',
          width: '100%',
          maxWidth: '400px',
          color: 'white'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            ⚙️ CONFIGURACIÓN INICIAL
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
            Selecciona el modo de conexión:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => saveConfig('cloud')}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderRadius: '12px',
                border: '1px solid #1e293b',
                backgroundColor: '#1a1d26',
                color: 'white',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <strong>☁️ Solo Nube</strong><br />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Firebase Online</span>
            </button>

            <button
              onClick={handleLocalClick}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderRadius: '12px',
                border: '1px solid #1e293b',
                backgroundColor: '#1a1d26',
                color: 'white',
                textAlign: 'left'
              }}
            >
              <strong>🖥️ Servidor Local</strong><br />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Escuela (Físico)</span>
            </button>

            <button
              onClick={handleHybridClick}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderRadius: '12px',
                border: '1px solid #1e293b',
                backgroundColor: '#1a1d26',
                color: 'white',
                textAlign: 'left'
              }}
            >
              <strong>⚡ Modo Híbrido</strong><br />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nube + Local</span>
            </button>
          </div>

          {showIpInput && (
            <div style={{
              borderTop: '1px solid #1e293b',
              paddingTop: '16px'
            }}>
              <p style={{
                fontSize: '14px',
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
                  padding: '12px',
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #1e293b',
                  backgroundColor: '#0a0c10',
                  color: 'white',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}
              />
              <button
                onClick={handleConnect}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#f97316',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textTransform: 'uppercase'
                }}
              >
                Conectar Ahora
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VERSIÓN FLOTANTE (solo para super-admin)
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
