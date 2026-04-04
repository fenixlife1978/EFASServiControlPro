'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { Building2, Layers, Zap, X } from 'lucide-react';

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

  // 1. Cargar sedes (institutions)
  useEffect(() => {
    const fetchSedes = async () => {
      try {
        const sedesRef = collection(db, "institutions");
        const snapshot = await getDocs(sedesRef);
        setSedes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error cargando sedes:", error);
      }
    };
    fetchSedes();
  }, []);

  // 2. Cargar aulas de la sede seleccionada
  useEffect(() => {
    if (!selectedSede) return;
    const fetchAulas = async () => {
      const aulasRef = collection(db, "institutions", selectedSede, "Aulas");
      const snapshot = await getDocs(aulasRef);
      setAulas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setSelectedAula('');
      setSeccionesDisponibles([]);
      setSelectedSeccion('');
    };
    fetchAulas();
  }, [selectedSede]);

  // 3. Obtener secciones cuando se selecciona un aula
  useEffect(() => {
    if (!selectedAula) return;
    const aula = aulas.find(a => a.id === selectedAula);
    if (aula && aula.section) {
      setSeccionesDisponibles([aula.section]);
      setSelectedSeccion(aula.section);
    } else {
      setSeccionesDisponibles(['A', 'B', 'C', 'D']);
      setSelectedSeccion('');
    }
  }, [selectedAula, aulas]);

  // 4. Calcular correlativo de dispositivo (DEV-XXXX)
  useEffect(() => {
    if (!selectedSede) return;
    const getNextNumber = async () => {
      const q = query(collection(db, "dispositivos"), where("InstitutoId", "==", selectedSede));
      const snapshot = await getDocs(q);
      const maxNumber = snapshot.docs.reduce((max, doc) => {
        const match = doc.id.match(/DEV-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          return num > max ? num : max;
        }
        return max;
      }, 0);
      setNextDeviceNumber(maxNumber + 1);
    };
    getNextNumber();
  }, [selectedSede]);

  const generarQR = async () => {
    if (!selectedSede || !selectedAula || !selectedSeccion) return;
    setLoading(true);
    try {
      const deviceId = `DEV-${String(nextDeviceNumber).padStart(4, '0')}`;
      
      // Estructura del QR compatible con ScannerVincular.tsx
      const qrData = {
        deviceId,
        InstitutoId: selectedSede, // Mantenemos PascalCase para consistencia con tus reglas
        aulaId: selectedAula,
        seccion: selectedSeccion,
        rol: selectedRol.toLowerCase(),
        timestamp: Date.now()
      };
      
      setQrValue(JSON.stringify(qrData));
      setShowQR(true);
      
      // Registrar en pendientes para validación opcional
      await addDoc(collection(db, "pendientes"), {
        ...qrData,
        status: 'pending',
        createdAt: serverTimestamp(),
        // Forzamos el modo Lista Blanca desde la intención
        config_inicial: {
          useWhitelist: true,
          useBlacklist: false,
          shieldMode: true
        }
      });
      
    } catch (error) {
      console.error("Error generando vinculación:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-2">
            EDU <span className="text-orange-500">CONTROLPRO</span>
          </h1>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
            INSTITUTIONAL SECURITY
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-black italic uppercase text-slate-400 flex items-center gap-3">
            <Zap className="w-5 h-5 text-orange-500" />
            ESTACIÓN DE VINCULACIÓN
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
              <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4" /> 1. SEDE
              </label>
              <select 
                value={selectedSede}
                onChange={(e) => setSelectedSede(e.target.value)}
                className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase"
              >
                <option value="">Seleccionar Sede</option>
                {sedes.map(sede => (
                  <option key={sede.id} value={sede.id}>{sede.nombre || sede.id}</option>
                ))}
              </select>
            </div>

            {selectedSede && (
              <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6 animate-in fade-in slide-in-from-left-4">
                <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4" /> 2. AULA
                </label>
                <select 
                  value={selectedAula}
                  onChange={(e) => setSelectedAula(e.target.value)}
                  className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase"
                >
                  <option value="">Seleccionar Aula</option>
                  {aulas.map(aula => (
                    <option key={aula.id} value={aula.id}>{aula.nombre || aula.id}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedAula && (
              <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6 animate-in fade-in slide-in-from-left-4">
                <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4" /> 3. SECCIÓN
                </label>
                <select 
                  value={selectedSeccion}
                  onChange={(e) => setSelectedSeccion(e.target.value)}
                  className="w-full bg-[#1a1d26] border border-slate-800 p-4 rounded-xl focus:border-orange-500 outline-none font-bold text-slate-200 text-[10px] uppercase"
                >
                  <option value="">Seleccionar Sección</option>
                  {seccionesDisponibles.map(seccion => (
                    <option key={seccion} value={seccion}>Sección {seccion}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
              <label className="text-[10px] font-black uppercase text-orange-500 ml-2 italic mb-4 block">SELECCIONAR ROL</label>
              <div className="grid grid-cols-2 gap-3">
                {['ALUMNO', 'PROFESOR', 'DIRECTOR', 'ADMIN'].map((rol) => (
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

            <button
              onClick={generarQR}
              disabled={!selectedSeccion || loading}
              className="w-full bg-orange-500 disabled:bg-slate-800 text-white py-6 rounded-2xl font-black uppercase text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-3"
            >
              <Zap className="w-5 h-5" />
              {loading ? 'GENERANDO...' : 'ACTIVAR ESTACIÓN'}
            </button>

            {selectedSede && (
              <div className="bg-[#11141d] border border-white/5 rounded-3xl p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">ID ASIGNADO</p>
                <p className="text-2xl font-mono font-bold text-orange-500">
                  DEV-{String(nextDeviceNumber).padStart(4, '0')}
                </p>
              </div>
            )}
          </div>
        </div>

        {showQR && (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[3rem] max-w-sm w-full relative shadow-2xl">
              <button 
                onClick={() => setShowQR(false)}
                className="absolute -top-4 -right-4 bg-orange-500 text-white p-3 rounded-full shadow-xl hover:bg-orange-600 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-black italic uppercase text-slate-900 mb-6 text-center">
                VINCULACIÓN <span className="text-orange-500">LISTA BLANCA</span>
              </h3>
              <div className="bg-white p-4 rounded-2xl border-4 border-slate-100">
                <QRCode value={qrValue} size={280} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox={`0 0 256 256`} />
              </div>
              <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6">
                {JSON.parse(qrValue).deviceId}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}