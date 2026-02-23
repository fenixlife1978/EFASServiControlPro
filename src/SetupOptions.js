// Esta es la pantalla que verá el usuario al instalar
const SetupOptions = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Configuración de Base de Datos</h1>
      <p>Selecciona dónde se guardará la información de las instituciones:</p>
      
      <div>
        <input type="radio" id="local" name="db" value="local" />
        <label for="local"> <b>Opción 1:</b> Almacenamiento Local (En esta PC)</label>
      </div>

      <div style={{ marginTop: '10px' }}>
        <input type="radio" id="server" name="db" value="server" />
        <label for="server"> <b>Opción 2:</b> Servidor Propio (Para conectar varias escuelas)</label>
      </div>

      <div style={{ marginTop: '10px' }}>
        <input type="radio" id="cloud" name="db" value="cloud" />
        <label for="cloud"> <b>Opción 3:</b> Nube (Firebase / Internet)</label>
      </div>

      <button style={{ marginTop: '20px' }}>Guardar y Continuar</button>
    </div>
  );
};
