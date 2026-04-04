'use client';
import React, { useState, useEffect } from 'react';
// MIGRACIÓN: Importamos RTDB y Firestore
import { rtdb, db } from '@/firebase/config';
import { ref, onValue, set, serverTimestamp as rtdbTimestamp, update } from 'firebase/database';
import { doc, setDoc, serverTimestamp as firestoreTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { School, Plus, Hash, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function InstitutionsPage() {
  const [institutos, setInstitutos] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [customId, setCustomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Escuchar instituciones desde Firestore (fuente principal)
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const institutionsRef = collection(db, 'institutions');
        const q = query(institutionsRef);
        const querySnapshot = await getDocs(q);
        
        const lista = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setInstitutos(lista);
      } catch (error) {
        console.error('Error cargando instituciones:', error);
      }
    };
    
    fetchInstitutions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !customId.trim()) return;
    
    setLoading(true);
    setError(null);
    const instId = customId.trim().toUpperCase();

    try {
      // 1. Crear en Firestore (fuente principal)
      const institutionRef = doc(db, 'institutions', instId);
      await setDoc(institutionRef, {
        id: instId,
        name: nombre.trim(),
        nombre: nombre.trim(),
        createdAt: firestoreTimestamp(),
        isActive: true,
        allowAccessGlobal: false,
        shieldModeGlobal: false
      });

      // 2. Crear estructura en RTDB para configuraciones
      await set(ref(rtdb, `config/instituciones/${instId}`), {
        nombre: nombre.trim(),
        activo: true,
        allowAccessGlobal: false,
        shieldModeGlobal: false,
        lastUpdate: Date.now(),
        createdAt: rtdbTimestamp()
      });

      // 3. Crear contador de estadísticas
      await set(ref(rtdb, `stats/instituciones/${instId}`), {
        total_devices: 0,
        active_devices: 0,
        blocked_attempts: 0,
        created_at: Date.now()
      });

      // 4. También crear en nodo legacy 'instituciones' por compatibilidad
      await set(ref(rtdb, `instituciones/${instId}`), {
        nombre: nombre.trim(),
        InstitutoId: instId,
        createdAt: rtdbTimestamp(),
        status: 'active'
      });

      // Limpiar formulario
      setNombre('');
      setCustomId('');
      
      // Actualizar lista local
      setInstitutos(prev => [...prev, {
        id: instId,
        name: nombre.trim(),
        nombre: nombre.trim(),
        isActive: true
      }]);
      
      alert(`Institución ${instId} creada exitosamente`);
    } catch (error) {
      console.error("Error en despliegue:", error);
      setError(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const goToSuperAdmin = () => {
    router.push('/dashboard/super-admin');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black italic uppercase text-slate-900 tracking-tighter">
            Control de <span className="text-orange-500">Instituciones</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">
            Configuración Rooted de EFAS ServiControlPro • Core Administrativo
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={goToSuperAdmin}
            className="bg-slate-800 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase italic tracking-widest hover:bg-orange-500 transition-all"
          >
            Dashboard Global
          </button>
          <div className="bg-orange-500 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase italic tracking-widest shadow-lg shadow-orange-500/20">
            Super Admin Access
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-600 text-xs font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Formulario con ID Manual */}
        <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] h-fit">
          <h2 className="font-black italic uppercase text-xs mb-8 flex items-center gap-2 text-slate-700">
            <Plus className="w-4 h-4 text-orange-500" /> Registrar Nueva Institución
          </h2>
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">
                ID de la Institución (Manual)
              </label>
              <input 
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mt-1 font-bold focus:border-orange-500 outline-none transition-all uppercase placeholder:text-slate-300 shadow-inner"
                placeholder="EJ: COLEGIO-VALLE-01"
                required
              />
              <p className="text-[8px] text-slate-400 mt-1 ml-2">
                Usar mayúsculas y guiones. Este ID se usará para identificar la sede.
              </p>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nombre Comercial</label>
              <input 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mt-1 font-bold focus:border-orange-500 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="Nombre de la Institución"
                required
              />
            </div>
            <button 
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase italic text-xs hover:bg-orange-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : "Vincular al Sistema"}
            </button>
          </form>
        </div>

        {/* Lista de Institutos Registrados */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-6 px-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Instituciones en Red</h3>
            <span className="text-[10px] font-black text-slate-300 uppercase italic">Total: {institutos.length}</span>
          </div>
          
          {institutos.length === 0 && (
            <div className="p-20 border-4 border-dashed rounded-[4rem] text-center text-slate-200 font-black uppercase italic text-sm">
              Esperando despliegue de nodos...
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {institutos.map(inst => (
              <div key={inst.id} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] flex items-center justify-between group hover:shadow-2xl hover:border-orange-100 transition-all cursor-default shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="bg-slate-900 text-white p-5 rounded-3xl group-hover:bg-orange-500 transition-colors shadow-lg">
                    <School className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black italic uppercase text-slate-800 text-xl tracking-tighter leading-tight">{inst.name || inst.nombre}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 border border-slate-200">
                        <Hash className="w-3 h-3 text-orange-500" /> {inst.id}
                      </span>
                      <span className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1 bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                        <ShieldCheck className="w-3 h-3" /> Nodo Activo
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
