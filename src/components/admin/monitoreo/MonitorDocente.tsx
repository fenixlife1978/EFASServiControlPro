'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, get, update, push, off } from 'firebase/database';
import { 
  Users, Loader2, Search, Edit3, Mail, FileText, 
  Wifi, WifiOff, Clock, AlertTriangle, Smartphone, 
  BookOpen, School, Download, Globe, ShieldX, Lock, Unlock, History as HistoryIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WebHistoryModal } from '@/components/admin/monitoring/WebHistoryModal';

interface TeacherDevice {
  deviceId: string;
  data: {
    alumno_asignado?: string;
    nombre?: string;
    aulaId?: string;
    seccion?: string;
    rol?: string;
    online?: boolean;
    lastSeen?: number;
    url_actual?: string;
    ultimo_pulso?: number;
    shield_mode_enable?: boolean;
  };
}

export function MonitorDocente() {
  const { institutionId } = useInstitution();
  const [teachers, setTeachers] = useState<TeacherDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<TeacherDevice | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editAula, setEditAula] = useState('');
  const [editSeccion, setEditSeccion] = useState('');
  
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherDevice | null>(null);
  const [mensajeDirecto, setMensajeDirecto] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const [historyModal, setHistoryModal] = useState({ isOpen: false, deviceId: '', nombre: '' });
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const updateTeacherData = useCallback((deviceId: string, updates: Partial<TeacherDevice['data']>) => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      setTeachers(prev => prev.map(t => t.deviceId === deviceId ? { ...t, data: { ...t.data, ...updates } } : t));
    }, 100);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    const statusRef = ref(rtdb, 'status_dispositivos');
    const unsub = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        Object.entries(data).forEach(([deviceId, status]: [string, any]) => {
          const lastSeen = status.lastSeen || status.heartbeat || 0;
          updateTeacherData(deviceId, {
            online: lastSeen > 0 && (Date.now() - lastSeen) < 45000,
            lastSeen: lastSeen,
            url_actual: status.url_actual,
            shield_mode_enable: status.shield_mode_enable === true
          });
        });
      }
    });
    return () => off(statusRef);
  }, [institutionId, updateTeacherData]);

  useEffect(() => {
    if (!institutionId) return;
    const dispositivosRef = ref(rtdb, 'dispositivos');
    const unsub = onValue(dispositivosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .filter(([_, d]: [any, any]) => d.InstitutoId === institutionId && d.rol === 'profesor')
          .map(([id, d]: [string, any]) => ({
            deviceId: id,
            data: { ...d, alumno_asignado: d.alumno_asignado || d.nombre || 'Docente' }
          }));
        setTeachers(list);
      }
      setLoading(false);
    });
    return () => off(dispositivosRef);
  }, [institutionId]);

  const handleToggleBlock = async (deviceId: string, current: boolean) => {
    try {
      const target = !current;
      await update(ref(rtdb), {
        [`dispositivos/${deviceId}/shield_mode_enable`]: target,
        [`status_dispositivos/${deviceId}/shield_mode_enable`]: target,
        [`status_dispositivos/${deviceId}/last_command_ts`]: Date.now()
      });
      toast.success(target ? "Dispositivo bloqueado" : "Dispositivo liberado");
    } catch (e) { toast.error("Error de conexión"); }
  };

  const handleSendMessage = async () => {
    if (!selectedTeacher || !mensajeDirecto.trim()) return;
    setSendingMessage(true);
    try {
      const timestamp = Date.now();
      const messageId = `msg_${timestamp}`;
      await update(ref(rtdb, `dispositivos/${selectedTeacher.deviceId}/mensaje_actual`), {
        mensaje: mensajeDirecto.trim(),
        remitente: 'DIRECCIÓN',
        messageId,
        timestamp,
        leido: false
      });
      toast.success('Mensaje enviado');
      setShowMessageDialog(false);
      setMensajeDirecto('');
    } catch (e) { toast.error('Error al enviar'); }
    setSendingMessage(false);
  };

  const filtered = teachers.filter(t => 
    t.data.alumno_asignado?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center font-black italic uppercase text-slate-500 animate-pulse">Sincronizando Personal...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <Input 
            placeholder="BUSCAR PROFESOR..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0f1117] border-slate-800 text-[10px] font-black uppercase italic" 
          />
        </div>
        <Badge className="bg-orange-500/10 text-orange-500 border-none font-black italic uppercase py-2 px-4">
          {teachers.length} DOCENTES VINCULADOS
        </Badge>
      </div>

      <div className="grid gap-4">
        {filtered.map((t) => (
          <div key={t.deviceId} className={`bg-[#0f1117] border rounded-[2rem] p-6 transition-all ${t.data.shield_mode_enable ? 'border-red-500/50' : 'border-slate-800'}`}>
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-4 rounded-2xl ${t.data.online ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-600'}`}>
                  <Smartphone size={24} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black italic uppercase text-white truncate">{t.data.alumno_asignado}</h3>
                    {t.data.online && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_green]" />}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase italic">ID: {t.deviceId.slice(-10)}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase italic">AULA: {t.data.aulaId} - SECC: {t.data.seccion}</span>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 px-6 py-3 rounded-2xl border border-white/5 flex-1 min-w-[200px]">
                <p className="text-[8px] font-black text-slate-600 uppercase mb-1 flex items-center gap-2"><Globe size={10}/> Navegación Live</p>
                <p className="text-[10px] text-blue-400 font-bold truncate italic">{t.data.url_actual || 'Esperando navegación...'}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setHistoryModal({ isOpen: true, deviceId: t.deviceId, nombre: t.data.alumno_asignado || '' })} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
                  <HistoryIcon size={18} className="text-blue-400"/>
                </button>
                <button onClick={() => { setSelectedTeacher(t); setShowMessageDialog(true); }} className="p-3 bg-slate-800 hover:bg-orange-600 rounded-xl transition-all">
                  <Mail size={18} className="text-white"/>
                </button>
                <button 
                  onClick={() => handleToggleBlock(t.deviceId, t.data.shield_mode_enable || false)}
                  className={`p-3 rounded-xl transition-all ${t.data.shield_mode_enable ? 'bg-red-600 text-white' : 'bg-slate-800 text-red-500 hover:bg-red-600 hover:text-white'}`}
                >
                  {t.data.shield_mode_enable ? <Lock size={18}/> : <ShieldX size={18}/>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <WebHistoryModal 
        isOpen={historyModal.isOpen} 
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })} 
        deviceId={historyModal.deviceId} 
        alumnoNombre={historyModal.nombre} 
      />

      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="bg-[#0f1117] border-slate-800 text-white">
          <DialogHeader><DialogTitle className="italic font-black uppercase text-xl">Mensajería Directa</DialogTitle></DialogHeader>
          <textarea 
            value={mensajeDirecto} 
            onChange={e => setMensajeDirecto(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-sm outline-none focus:border-orange-500 h-32"
            placeholder="ESCRIBE EL COMUNICADO..."
          />
          <DialogFooter>
            <Button disabled={sendingMessage} onClick={handleSendMessage} className="bg-orange-500 hover:bg-orange-600 font-black uppercase italic">
              {sendingMessage ? 'Enviando...' : 'Transmitir Alerta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}