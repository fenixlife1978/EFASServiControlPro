'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db, rtdb, auth } from '@/firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, onValue, off, update } from 'firebase/database';
import { 
  ChevronLeft, Building2, User, Globe, History, ShieldCheck, 
  MessageSquare, Loader2, Clock, Activity, ShieldX
} from 'lucide-react';
import { toast } from 'sonner';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';
import DirectMessage from '@/components/admin/messaging/DirectMessage';

interface UserDevice {
  id: string;
  deviceId: string;
  nombre: string;
  role: string;
  email: string;
  realtime?: {
    lastSeen?: number;
    url_actual?: string;
    shield_mode_enable?: boolean;
    admin_mode_enable?: boolean;
  }
}

interface SedeMonitorClientProps {
  institutoId: string;
}

export default function SedeMonitorClient({ institutoId }: SedeMonitorClientProps) {
  const { userRole, loadingPermissions } = useInstitution();
  const router = useRouter();
  const [nombreSede, setNombreSede] = useState('Cargando...');
  const [realInstitutionId, setRealInstitutionId] = useState<string | null>(null);
  const [personal, setPersonal] = useState<UserDevice[]>([]);
  const [rtStatus, setRtStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [historyModal, setHistoryModal] = useState({ isOpen: false, deviceId: '', nombre: '' });
  const [messageModal, setMessageModal] = useState({ isOpen: false, deviceId: '', nombre: '' });

  // ============================================
  // VERIFICACIÓN DE PERMISOS - Director Supervisor tiene ACCESO TOTAL
  // ============================================
  useEffect(() => {
    if (!loadingPermissions) {
      // Director-Supervisor tiene privilegios de SUPER ADMIN - sin restricciones
      const hasAccess = userRole === 'super-admin' || 
                       userRole === 'director-supervisor' || 
                       userRole === 'supervisor';
      
      console.log('Verificando permisos en SedeMonitorClient:', {
        userRole,
        hasAccess,
        institutoId
      });
      
      if (!hasAccess) {
        toast.error('No tienes permisos para acceder a esta sección');
        router.push('/dashboard/unauthorized');
      }
    }
  }, [userRole, loadingPermissions, router, institutoId]);

  // Buscar la institución por InstitutoId o por ID real
  useEffect(() => {
    if (!institutoId) return;
    
    const findInstitution = async () => {
      try {
        console.log('Buscando institución con ID:', institutoId);
        
        // Primero, intentar buscar por ID real (Firestore ID)
        const docRef = doc(db, "institutions", institutoId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNombreSede(data.nombre || data.InstitutoId || 'Sede');
          setRealInstitutionId(institutoId);
          console.log('Institución encontrada por ID real:', realInstitutionId);
          return;
        }
        
        // Si no se encontró por ID real, buscar por campo InstitutoId
        const q = query(collection(db, "institutions"), where("InstitutoId", "==", institutoId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const institutionDoc = querySnapshot.docs[0];
          const data = institutionDoc.data();
          setNombreSede(data.nombre || data.InstitutoId || 'Sede');
          setRealInstitutionId(institutionDoc.id);
          console.log('Institución encontrada por campo InstitutoId:', {
            institutoId,
            realId: institutionDoc.id
          });
          return;
        }
        
        // No se encontró la institución
        console.error('Institución no encontrada:', institutoId);
        setNombreSede('Sede no encontrada');
        toast.error('No se encontró la institución');
        setTimeout(() => router.push('/dashboard'), 2000);
        
      } catch (error) {
        console.error('Error al buscar institución:', error);
        setNombreSede('Error al cargar');
        toast.error('Error al cargar la información de la sede');
      }
    };
    
    findInstitution();
  }, [institutoId, router]);

  // Cargar personal usando el ID real de Firestore
  useEffect(() => {
    if (!realInstitutionId) return;
    
    console.log('Cargando personal para institución:', realInstitutionId);
    
    const q = query(
      collection(db, "usuarios"), 
      where("InstitutoId", "==", realInstitutionId),
      where("role", "in", ["director", "profesor"])
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as UserDevice[];
      setPersonal(list);
      setLoading(false);
      console.log('Personal cargado:', list.length);
    });

    return () => unsub();
  }, [realInstitutionId]);

  // Cargar estado en tiempo real de dispositivos
  useEffect(() => {
    const statusRef = ref(rtdb, 'status_dispositivos');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        setRtStatus(snapshot.val());
      }
    });
    return () => off(statusRef);
  }, []);

  const combinedData = useMemo(() => {
    return personal.map(p => {
      const deviceId = p.deviceId || p.id;
      return {
        ...p,
        realtime: rtStatus[deviceId] || {}
      };
    });
  }, [personal, rtStatus]);

  const filtered = combinedData.filter(p => 
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleBlock = async (deviceId: string, currentStatus: boolean) => {
    try {
      const nuevoEstado = !currentStatus;
      const updates: any = {};
      updates[`/dispositivos/${deviceId}/shield_mode_enable`] = nuevoEstado;
      updates[`/status_dispositivos/${deviceId}/shield_mode_enable`] = nuevoEstado;
      
      await update(ref(rtdb), updates);
      toast.success(nuevoEstado ? "🛡️ Dispositivo BLOQUEADO" : "🔓 Dispositivo LIBERADO");
    } catch (e) {
      console.error('Error al bloquear dispositivo:', e);
      toast.error("Error al enviar comando");
    }
  };

  const checkIsOnline = (lastSeen?: number) => {
    if (!lastSeen) return false;
    return (Date.now() - lastSeen) < 45000;
  };

  if (loadingPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
        <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="flex items-start gap-6">
          <button 
            onClick={() => router.back()}
            className="bg-[#0f1117] border border-slate-800 p-4 rounded-2xl text-slate-500 hover:text-orange-500 hover:scale-110 transition-all shadow-xl"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.4em] italic">Sede Monitorizada</span>
            </div>
            <h1 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">
              {nombreSede}
            </h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">
              Control Jerárquico de Director y Personal Docente
            </p>
          </div>
        </div>

        <div className="bg-[#0f1117] border border-slate-800 px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-slate-500 uppercase">Estado Red</span>
            <span className="text-xs font-black text-green-500 uppercase italic">Sincronización Live</span>
          </div>
          <div className="width-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
            <Activity className="text-green-500 animate-pulse" size={20} />
          </div>
        </div>
      </header>

      <div className="max-w-md">
        <input 
          type="text"
          placeholder="FILTRAR POR NOMBRE O ROL..."
          className="w-full bg-[#0f1117] border border-slate-800 rounded-2xl py-4 px-6 text-white text-[10px] font-black uppercase outline-none focus:border-orange-500 transition-all shadow-xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={40} />
            <p className="text-slate-500 font-black uppercase text-xs">Escaneando Personal...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-800 rounded-[3rem]">
            <p className="text-slate-600 font-black uppercase italic text-xs">No hay personal registrado en esta sede</p>
          </div>
        ) : (
          filtered.map((p) => {
            const deviceId = p.deviceId || p.id;
            const isOnline = checkIsOnline(p.realtime?.lastSeen);
            const isBlocked = p.realtime?.shield_mode_enable === true;
            
            return (
              <div 
                key={p.id} 
                className={`bg-[#0f1117] border rounded-[2.5rem] p-8 shadow-2xl transition-all relative group ${
                  isBlocked ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800 hover:border-orange-500/40'
                }`}
              >
                <div className={`absolute top-8 right-8 flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border ${isOnline ? 'border-green-500/20' : 'border-slate-800'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                  <span className={`text-[8px] font-black uppercase ${isOnline ? 'text-green-500' : 'text-slate-600'}`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <div className="flex items-center gap-5 mb-8">
                  <div className={`p-4 rounded-2xl ${p.role === 'director' ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-slate-800 text-slate-400'} shadow-lg`}>
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic uppercase text-white truncate max-w-[180px] leading-none mb-1">
                      {p.nombre}
                    </h3>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
                      {p.role === 'director' ? 'Director de Sede' : 'Personal Docente'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 group-hover:border-orange-500/20 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="text-slate-600" size={12} />
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Navegación Activa</span>
                    </div>
                    <p className="text-[10px] text-blue-400 font-bold truncate lowercase italic">
                      {p.realtime?.url_actual || 'Browser Inactivo'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 px-2">
                    <Clock className="text-slate-700" size={12} />
                    <span className="text-[9px] font-bold text-slate-600 uppercase">
                      Visto: {p.realtime?.lastSeen ? new Date(p.realtime.lastSeen).toLocaleTimeString() : '---'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setHistoryModal({ isOpen: true, deviceId, nombre: p.nombre })}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl transition-all"
                  >
                    <History size={14} className="text-blue-400" />
                    <span className="text-[9px] font-black uppercase italic text-white">Historial</span>
                  </button>
                  
                  <button 
                    onClick={() => setMessageModal({ isOpen: true, deviceId, nombre: p.nombre })}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-orange-600 py-3 rounded-xl transition-all group/msg"
                  >
                    <MessageSquare size={14} className="text-orange-500 group-hover/msg:text-white" />
                    <span className="text-[9px] font-black uppercase italic text-white">Mensaje</span>
                  </button>

                  <button 
                    onClick={() => handleToggleBlock(deviceId, isBlocked)}
                    className={`col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black uppercase italic text-[10px] transition-all border-2 shadow-xl ${
                      isBlocked 
                        ? 'bg-green-600/10 border-green-500 text-green-500 hover:bg-green-600 hover:text-white' 
                        : 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {isBlocked ? <ShieldCheck size={16} /> : <ShieldX size={16} />}
                    {isBlocked ? 'DESBLOQUEAR DISPOSITIVO' : 'BLOQUEO TOTAL'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <WebHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })}
        deviceId={historyModal.deviceId}
        alumnoNombre={historyModal.nombre}
        institutoId={realInstitutionId || institutoId}
      />

      {messageModal.isOpen && (
        <DirectMessage 
          deviceId={messageModal.deviceId}
          alumnoNombre={messageModal.nombre}
          userRole="super-admin"
          onClose={() => setMessageModal({ ...messageModal, isOpen: false })}
        />
      )}
    </div>
  );
}
