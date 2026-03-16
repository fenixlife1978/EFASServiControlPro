'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { Building2, Layers, Users, ShieldCheck, Zap, QrCode, X } from 'lucide-react';

export default function VincularUI() {
  const { institutionId } = useInstitution();
  const [sedes, setSedes] = useState<any[]>([]);
  const [selectedSede, setSelectedSede] = useState('');
  const [aulas, setAulas] = useState<any[]>([]);
  const [selectedAula, setSelectedAula] = useState('');
  const [seccionesDisponibles, setSeccionesDisponibles] = useState<string[]>([]);
  const [selectedSeccion, setSelectedSeccion] = useState('');
  const [selectedRol, setSelectedRol] = useState('ALUMNO');
  const [nextDeviceNumber, setNextDeviceNumber] = useState(1);
  const [qrValue, setQrValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Cargar sedes (instituciones)
  useEffect(() => {
    const fetchSedes = async () => {
      const sedesRef = collection(db, "institutions");
      const snapshot = await getDocs(sedesRef);
      setSedes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchSedes();
  }, []);

  // PASO 2: Cargar aulas de la sede seleccionada
  useEffect(() => {
    if (!selectedSede) return;
    
    const fetchAulas = async () => {
      const aulasRef = collection(db, "institutions", selectedSede, "Aulas");
      const snapshot = await getDocs(aulasRef);
      console.log("Aulas encontradas:", snapshot.size);
      
      const aulasData = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      }));
      
      setAulas(aulasData);
      
      // Limpiar selecciones
      setSelectedAula('');
      setSeccionesDisponibles([]);
      setSelectedSeccion('');
    };
    fetchAulas();
  }, [selectedSede]);

  // PASO 3: Cuando se selecciona un aula, obtener su sección
  useEffect(() => {
    if (!selectedAula) {
      setSeccionesDisponibles([]);
      setSelectedSeccion('');
      return;
    }

    const fetchAulaDetails = async () => {
      try {
        const aula = aulas.find(a => a.id === selectedAula);
        
        if (aula && aula.section) {
          setSeccionesDisponibles([aula.section]);
          setSelectedSeccion(aula.section);
        } else {
          setSeccionesDisponibles(['A', 'B', 'C']);
          setSelectedSeccion('');
        }
      } catch (error) {
        console.error("Error obteniendo detalles del aula:", error);
      }
    };

    fetchAulaDetails();
  }, [selectedAula, aulas]);

  // Calcular siguiente número de dispositivo
  useEffect(() => {
    if (!selectedSede) return;
    const getNextDeviceNumber = async () => {
      const dispositivosRef = collection(db, "dispositivos");
      const q = query(dispositivosRef, where("InstitutoId", "==", selectedSede));
      const snapshot = await getDocs(q);
      const maxNumber = snapshot.docs.reduce((max, doc) => {
        const id = doc.id;
        const match = id.match(/DEV-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      setNextDeviceNumber(maxNumber + 1);
    };
    getNextDeviceNumber();
  }, [selectedSede]);

  const generarQR = async () => {
    if (!selectedSede || !selectedAula || !selectedSeccion) return;
    
    setLoading(true);
    try {
      const deviceId = `DEV-${String(nextDeviceNumber).padStart(4, '0')}`;
      
      const qrData = {
        deviceId,
        InstitutoId: selectedSede,
        aulaId: selectedAula,
        seccion: selectedSeccion,
        rol: selectedRol.toLowerCase(),
        timestamp: Date.now()
      };
      
      setQrValue(JSON.stringify(qrData));
      setShowQR(true);
      
      await addDoc(collection(db, "pendientes"), {
        deviceId,
        InstitutoId: selectedSede,
        aulaId: selectedAula,
        seccion: selectedSeccion,
        rol: selectedRol.toLowerCase(),
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-2">
            EDU <span className="text-orange-500">CONTROLPRO</span>
          </h1>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
            INSTITUTIONAL SECURITY
          </p>
        </div>

        {/* Título de sección */}
        <div className="mb-8">
          <h2 className="text-2xl font-black italic uppercase text-slate-400 flex items-center gap-3">
            <Zap className="w-5 h-5 text-orange-500" />
            ESTACIÓN DE VINCULACIÓN
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Columna Izquierda - Selectores */}
          <div className="space-y-6">
            {/* 1. SEDE */}
            <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
              <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4" /> 1. SELECCIONAR SEDE
              </label>
              <select 
                value={selectedSede}
                onChange={(e) => {
                  setSelectedSede(e.target.value);
                  setSelectedAula('');
                  setSelectedSeccion('');
                }}
                className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase"
              >
                <option value="">Seleccionar Sede</option>
                {sedes.map(sede => (
                  <option key={sede.id} value={sede.id}>
                    {sede.nombre || sede.id}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. AULA (AHORA PRIMERO DESPUÉS DE SEDE) */}
            {selectedSede && (
              <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
                <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4" /> 2. SELECCIONAR AULA
                </label>
                <select 
                  value={selectedAula}
                  onChange={(e) => {
                    setSelectedAula(e.target.value);
                    setSelectedSeccion('');
                  }}
                  className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase"
                >
                  <option value="">Seleccionar Aula</option>
                  {aulas.map(aula => (
                    <option key={aula.id} value={aula.id}>
                      {aula.nombre || aula.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. SECCIÓN (AHORA SEGUNDO, basada en el aula) */}
            {selectedAula && seccionesDisponibles.length > 0 && (
              <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
                <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4" /> 3. SELECCIONAR SECCIÓN
                </label>
                <select 
                  value={selectedSeccion}
                  onChange={(e) => setSelectedSeccion(e.target.value)}
                  className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase"
                >
                  <option value="">Seleccionar Sección</option>
                  {seccionesDisponibles.map(seccion => (
                    <option key={seccion} value={seccion}>
                      Sección {seccion}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Columna Derecha - Roles y QR */}
          <div className="space-y-6">
            {/* Roles */}
            <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
              <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic mb-4 block">
                SELECCIONAR ROL
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['ALUMNO', 'SENCILLA', 'PROFESOR', 'RÁFAGA'].map((rol) => (
                  <button
                    key={rol}
                    onClick={() => setSelectedRol(rol)}
                    className={`p-4 rounded-xl font-black uppercase text-[10px] transition-all ${
                      selectedRol === rol 
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                        : 'bg-[#1a1d26] text-slate-400 hover:bg-orange-500/10'
                    }`}
                  >
                    {rol}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón Activar Estación */}
            <button
              onClick={generarQR}
              disabled={!selectedAula || !selectedSeccion || loading}
              className="w-full bg-orange-500 disabled:bg-slate-800 text-white py-6 rounded-2xl font-black uppercase text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-3"
            >
              <Zap className="w-5 h-5" />
              {loading ? 'GENERANDO...' : 'ACTIVAR ESTACIÓN'}
            </button>

            {/* Información del dispositivo */}
            {selectedSede && (
              <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">PRÓXIMO DISPOSITIVO</p>
                <p className="text-2xl font-mono font-bold text-orange-500">
                  DEV-{String(nextDeviceNumber).padStart(4, '0')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal QR */}
        {showQR && qrValue && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[3rem] max-w-md w-full relative">
              <button 
                onClick={() => setShowQR(false)}
                className="absolute -top-4 -right-4 bg-orange-500 text-white p-3 rounded-full shadow-xl hover:bg-orange-600 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-2xl font-black italic uppercase text-slate-900 mb-6 text-center">
                CÓDIGO DE <span className="text-orange-500">VINCULACIÓN</span>
              </h3>
              
              <QRCode value={qrValue} size={300} className="w-full h-auto mb-6" />
              
              <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                DISPOSITIVO: DEV-{String(nextDeviceNumber - 1).padStart(4, '0')}
              </p>
              <p className="text-center text-[8px] text-slate-400 mt-4">
                Escanea con la tablet para vincular
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}