'use client';

import React, { useState, useEffect } from 'react';
import { db, addDocumentNonBlocking } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SecurityAlertListener } from '@/components/student/SecurityAlertListener';
import { checkIsUrlBlocked } from '@/lib/security-filter';
import { 
  GraduationCap, Monitor, Globe, ArrowRight, 
  ShieldOff, ShieldCheck, Settings, Lock, Zap 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
// CORRECCIÓN: Importación desde dialog
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

export default function StudentDashboard() {
  const [studentId, setStudentId] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [masterKey, setMasterKey] = useState('');
  
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [globalConfig, setGlobalConfig] = useState({
    filterActive: true,
    maintenanceMode: false,
    strictMode: false
  });
  
  const { toast } = useToast();
  const router = useRouter();
  const institutionId = "CMG-002"; 

  useEffect(() => {
    if (!isLogged) return;
    const blackRef = doc(db, `institutions/${institutionId}/config`, 'security_rules');
    const unsubBlack = onSnapshot(blackRef, (snapshot) => {
      if (snapshot.exists()) setBlacklist(snapshot.data().blacklisted_urls || []);
    });
    const whiteRef = doc(db, `institutions/${institutionId}/config`, 'whitelist_rules');
    const unsubWhite = onSnapshot(whiteRef, (snapshot) => {
      if (snapshot.exists()) setWhitelist(snapshot.data().allowed_urls || []);
    });
    const globalRef = doc(db, `institutions/${institutionId}/config`, 'global_settings');
    const unsubGlobal = onSnapshot(globalRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        setGlobalConfig(data);
        if (data.maintenanceMode) router.push('/blocked');
      }
    });
    return () => { unsubBlack(); unsubWhite(); unsubGlobal(); };
  }, [isLogged, institutionId, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId) {
      localStorage.setItem('activeStudentId', studentId.toUpperCase());
      localStorage.setItem('activeInstitutoId', institutionId);
      setIsLogged(true);
    }
  };

  const handleTechAccess = () => {
    if (masterKey === "EFAS2026") {
      toast({ title: "MODO TÉCNICO", description: "Acceso Maestro Concedido." });
      setMasterKey('');
    } else {
      toast({ variant: "destructive", title: "Error", description: "Clave Incorrecta" });
      setMasterKey('');
    }
  };

  const handleSimulateNavigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    if (!globalConfig.filterActive) {
      toast({ title: "Navegación Libre", description: "Protección desactivada." });
      setUrlInput('');
      return;
    }
    const isBlocked = checkIsUrlBlocked(urlInput, blacklist, whitelist, globalConfig.strictMode);
    if (isBlocked) {
      try {
        await addDocumentNonBlocking(`institutions/${institutionId}/incidencias`, {
          estudianteId: studentId.toUpperCase(),
          estudianteNombre: `Estudiante ${studentId.toUpperCase()}`,
          tipo: globalConfig.strictMode ? 'STRICT_VIOLATION' : 'URL_BLOCKED',
          detalle: `Intento: "${urlInput}"`,
          status: 'nuevo',
          createdAt: new Date()
        });
        router.push('/blocked');
      } catch (error) { console.error(error); }
    } else {
      toast({ title: "Acceso Permitido", description: "Sitio seguro." });
      setUrlInput('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans p-6">
      {isLogged && (
        <SecurityAlertListener 
          institutionId={institutionId} 
          studentId={studentId.toUpperCase()} 
        />
      )}

      <main className="max-w-4xl mx-auto">
        {!isLogged ? (
          <div className="mt-20 max-w-md mx-auto bg-[#11141d] border border-white/5 p-10 rounded-[2.5rem] text-center shadow-2xl">
            <Zap className="w-12 h-12 text-orange-500 mx-auto mb-6 fill-orange-500" />
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">EFAS <span className="text-orange-500">PRO</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 mb-8">ServiControlPro Agent</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="text"
                placeholder="ID ESTUDIANTE"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full bg-black/40 rounded-2xl py-5 px-6 text-center font-black text-orange-500 outline-none border border-white/5 focus:border-orange-500/50"
              />
              <button className="w-full bg-orange-600 hover:bg-orange-500 py-5 rounded-2xl font-black italic uppercase transition-all shadow-lg shadow-orange-600/20 text-white">
                CONECTAR ESTACIÓN
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <header className="flex justify-between items-center bg-[#11141d] p-6 rounded-[2rem] border border-white/5">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/10">
                  <Monitor className="text-orange-500 w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white italic uppercase tracking-tight">{studentId.toUpperCase()}</h2>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Protección Activa</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-full border text-[9px] font-black uppercase flex items-center gap-2 ${globalConfig.filterActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${globalConfig.filterActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  {globalConfig.filterActive ? 'Escudo ON' : 'Escudo OFF'}
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <button className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                      <Settings className="w-5 h-5 text-slate-700 hover:text-orange-500" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#0f172a] border-2 border-orange-500/50 text-white rounded-[2rem]">
                    <DialogHeader className="items-center">
                      <Lock className="w-8 h-8 text-orange-500 mb-2" />
                      <DialogTitle className="text-xl font-black italic uppercase">Acceso Técnico</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <input
                        type="password"
                        placeholder="CLAVE MAESTRA"
                        value={masterKey}
                        onChange={(e) => setMasterKey(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-4 text-center text-xl font-mono tracking-[0.3em] outline-none"
                      />
                      <button onClick={handleTechAccess} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-xl">
                        AUTORIZAR
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </header>

            <section className="bg-[#11141d] p-6 rounded-[2rem] border border-white/5">
              <div className="flex items-center gap-2 text-slate-500 mb-4 ml-2">
                <Globe className="w-3 h-3 text-orange-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Navegación Protegida</span>
              </div>
              <form onSubmit={handleSimulateNavigation} className="flex gap-3">
                <input 
                  type="text"
                  placeholder="INGRESAR URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-black/40 rounded-xl py-4 px-6 text-xs font-bold border border-white/5 outline-none focus:border-orange-500/50"
                />
                <button type="submit" className="bg-orange-600 text-white px-6 rounded-xl">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex flex-col items-center">
                <ShieldCheck className={`w-8 h-8 mb-2 ${globalConfig.strictMode ? 'text-emerald-500' : 'text-slate-800'}`} />
                <p className="font-black italic uppercase text-[8px] text-slate-600 tracking-widest text-center">Modo Estricto: {globalConfig.strictMode ? 'ON' : 'OFF'}</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex flex-col items-center">
                <ShieldOff className="w-8 h-8 mb-2 text-red-500/30" />
                <p className="font-black italic uppercase text-[8px] text-slate-600 tracking-widest text-center">Filtro Inteligente</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}