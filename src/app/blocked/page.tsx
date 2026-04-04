'use client';

import React, { useEffect, useState } from 'react';
import { db, rtdb } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { ShieldAlert, Globe, AlertTriangle, Clock, School } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface InstitutionData {
  nombre?: string;
  name?: string;
  id?: string;
  isActive?: boolean;
}

export default function BlockedPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const [institutionData, setInstitutionData] = useState<InstitutionData | null>(null);
  const [studentId, setStudentId] = useState<string>('CARGANDO...');
  const [deviceId, setDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [blockedUrl, setBlockedUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Obtener información del localStorage
    const savedDeviceId = localStorage.getItem('efas_device_id');
    const savedStudent = localStorage.getItem('alumno_nombre') || 'SIN IDENTIFICAR';
    const savedUrl = localStorage.getItem('blocked_url') || 'Contenido restringido';
    
    setDeviceId(savedDeviceId || '');
    setStudentId(savedStudent);
    setBlockedUrl(savedUrl);
    
    // Obtener datos de la institución desde el contexto de autenticación o localStorage
    const fetchInstitutionData = async () => {
      try {
        let instId = userData?.InstitutoId;
        
        // Si no viene del contexto, buscar en localStorage
        if (!instId && typeof window !== 'undefined') {
          instId = localStorage.getItem('selectedInstitutionId') || 
                   localStorage.getItem('institutoId');
        }
        
        if (instId) {
          // 1. Intentar obtener desde RTDB primero (más rápido)
          const rtdbRef = ref(rtdb, `config/instituciones/${instId}`);
          const unsubscribe = onValue(rtdbRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              setInstitutionData({
                nombre: data.nombre || data.name,
                id: instId,
                isActive: data.activo
              });
              setLoading(false);
            } else {
              // 2. Fallback a Firestore
              const fetchFromFirestore = async () => {
                const docRef = doc(db, 'institutions', instId!);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  setInstitutionData({
                    nombre: data.name || data.nombre,
                    id: instId,
                    isActive: data.isActive
                  });
                }
                setLoading(false);
              };
              fetchFromFirestore();
            }
          });
          
          return () => off(rtdbRef);
        } else {
          // Si no hay ID de institución, usar datos por defecto
          setInstitutionData({ nombre: 'la institución', id: 'SEDE' });
          setLoading(false);
        }
      } catch (error) {
        console.error('Error cargando datos de institución:', error);
        setInstitutionData({ nombre: 'la institución' });
        setLoading(false);
      }
    };
    
    if (!authLoading) {
      fetchInstitutionData();
    }
  }, [userData, authLoading]);

  // Guardar la URL bloqueada en localStorage cuando se recibe desde el Intent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Verificar si hay parámetros en la URL
      const urlParams = new URLSearchParams(window.location.search);
      const blocked = urlParams.get('blocked');
      if (blocked) {
        localStorage.setItem('blocked_url', blocked);
        setBlockedUrl(blocked);
      }
    }
  }, []);

  const institutionName = institutionData?.nombre || institutionData?.name || 'la institución';
  const currentTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const currentDate = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white font-sans p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-red-600 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-orange-600 rounded-full blur-[120px]"></div>
      </div>

      <main className="max-w-xl w-full text-center space-y-10 relative z-10">
        {/* Shield Icon */}
        <div className="mx-auto w-32 h-32 bg-red-500/10 rounded-[2.5rem] flex items-center justify-center border-4 border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.3)] rotate-3">
          <ShieldAlert className="w-20 h-20 text-red-500 animate-pulse -rotate-3" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <AlertTriangle className="text-orange-500 w-4 h-4" />
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] bg-orange-500/10 px-4 py-1.5 rounded-full border border-orange-500/20">
              Protocolo de Seguridad Activo
            </span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-black italic uppercase tracking-tighter leading-none text-white">
            ACCESO <br /> <span className="text-red-600">DENEGADO</span>
          </h1>
          
          <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium leading-relaxed">
            Este contenido ha sido restringido por <span className="text-white font-bold">{institutionName}</span> bajo el entorno de seguridad <span className="font-black text-orange-500 uppercase italic">EDUControlPro</span>.
          </p>
          
          {blockedUrl && blockedUrl !== 'Contenido restringido' && (
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
              <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1">Intento de acceso a:</p>
              <p className="text-xs font-mono text-red-400 break-all">{blockedUrl}</p>
            </div>
          )}
        </div>

        {/* Status Card */}
        <div className="bg-[#11141d]/80 backdrop-blur-xl border border-white/5 p-7 rounded-[2.5rem] flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800/50 p-3 rounded-2xl">
                <School className="text-slate-400 w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Institución</p>
                <p className="text-sm font-black text-white uppercase">{institutionName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estado</p>
              <p className="text-xs font-black text-red-500 uppercase italic tracking-tighter">FILTRO ACTIVO</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800/50 p-3 rounded-2xl">
                <Globe className="text-slate-400 w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Dispositivo</p>
                <p className="text-xs font-mono font-bold text-orange-100">{studentId}</p>
                {deviceId && (
                  <p className="text-[7px] text-slate-600 font-mono mt-1">{deviceId.slice(-8)}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha/Hora</p>
              <p className="text-[9px] font-mono text-slate-400">{currentDate}</p>
              <p className="text-[9px] font-mono text-slate-500">{currentTime}</p>
            </div>
          </div>
        </div>

        <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.6em]">
          EDUControlPro • 2026
        </p>
      </main>
    </div>
  );
}