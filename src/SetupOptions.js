'use client';
import { useState } from 'react';
import { dbService } from '@/lib/dbService';
import { useRouter } from 'next/navigation';

// Esta es la pantalla que verá el usuario al instalar
const SetupOptions = () => {
  const [selectedOption, setSelectedOption] = useState('cloud');
  const [serverUrl, setServerUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const router = useRouter();

  const handleOptionChange = (option) => {
    setSelectedOption(option);
    setShowUrlInput(option === 'server' || option === 'local');
  };

  const handleSave = () => {
    // Guardar configuración usando dbService
    if (selectedOption === 'server' || selectedOption === 'local') {
      if (!serverUrl) {
        alert('Por favor ingresa la URL del servidor');
        return;
      }
      dbService.saveSettings(selectedOption, serverUrl);
    } else {
      dbService.saveSettings('firebase'); // 'cloud' se guarda como 'firebase'
    }
    
    // Redirigir al login o dashboard
    router.push('/login');
  };

  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'Arial',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#f5f5f5',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ color: '#333' }}>Configuración de Base de Datos</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Selecciona dónde se guardará la información de las instituciones:
      </p>
      
      <div style={{ marginBottom: '15px' }}>
        <input 
          type="radio" 
          id="local" 
          name="db" 
          value="local"
          checked={selectedOption === 'local'}
          onChange={() => handleOptionChange('local')}
        />
        <label htmlFor="local" style={{ marginLeft: '10px' }}>
          <b>Opción 1:</b> Almacenamiento Local (En esta PC)
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input 
          type="radio" 
          id="server" 
          name="db" 
          value="server"
          checked={selectedOption === 'server'}
          onChange={() => handleOptionChange('server')}
        />
        <label htmlFor="server" style={{ marginLeft: '10px' }}>
          <b>Opción 2:</b> Servidor Propio (Para conectar varias escuelas)
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input 
          type="radio" 
          id="cloud" 
          name="db" 
          value="cloud"
          checked={selectedOption === 'cloud'}
          onChange={() => handleOptionChange('cloud')}
        />
        <label htmlFor="cloud" style={{ marginLeft: '10px' }}>
          <b>Opción 3:</b> Nube (Firebase / Internet)
        </label>
      </div>

      {(selectedOption === 'server' || selectedOption === 'local') && (
        <div style={{ marginTop: '20px' }}>
          <label htmlFor="serverUrl" style={{ display: 'block', marginBottom: '5px' }}>
            URL del Servidor:
          </label>
          <input
            type="url"
            id="serverUrl"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://192.168.1.100:3000"
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ccc'
            }}
          />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Ejemplo: http://192.168.1.100:3000 o https://tuservidor.com
          </p>
        </div>
      )}

      <button 
        onClick={handleSave}
        style={{ 
          marginTop: '30px',
          padding: '12px 24px',
          backgroundColor: '#f97316',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Guardar y Continuar
      </button>
    </div>
  );
};

export default SetupOptions;