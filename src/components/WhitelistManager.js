import React, { useState, useEffect } from 'react';
import { rtdb } from '../firebaseConfig';
import { ref, onValue, push, remove } from 'firebase/database';

const WhitelistManager = () => {
  const [sites, setSites] = useState([]);
  const [newSite, setNewSite] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const whitelistRef = ref(rtdb, 'global/whitelist');
    const unsubscribe = onValue(whitelistRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convertir objeto de Firebase (con claves como -Nxxx) a un array
        const sitesArray = Object.keys(data).map(key => ({
          id: key,
          url: data[key]
        }));
        setSites(sitesArray);
      } else {
        setSites([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSite.trim()) return;
    const whitelistRef = ref(rtdb, 'global/whitelist');
    await push(whitelistRef, newSite.trim().toLowerCase());
    setNewSite('');
  };

  const handleDelete = async (id) => {
    await remove(ref(rtdb, `global/whitelist/${id}`));
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
      <h2>📋 Lista Blanca (Sitios Permitidos)</h2>
      
      <form onSubmit={handleAdd} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={newSite}
          onChange={(e) => setNewSite(e.target.value)}
          placeholder="ej: wikipedia.org"
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '8px 16px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Añadir
        </button>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {sites.map((site) => (
            <li key={site.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
              <span>{site.url}</span>
              <button
                onClick={() => handleDelete(site.id)}
                style={{ background: 'none', border: 'none', color: '#e00', cursor: 'pointer', fontSize: '1.2em' }}
                title="Eliminar"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default WhitelistManager;
