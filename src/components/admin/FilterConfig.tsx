'use client';

import { useState, useEffect } from 'react';
// Importación corregida para usar tu configuración personalizada [cite: 2026-01-27]
import { useFirestore } from '@/firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Save, Trash2, Globe, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function FilterConfig({ activeId }: { activeId: string }) {
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore(); // Hook centralizado de tu proyecto
  const { toast } = useToast();

  // Cargar configuración existente al iniciar
  useEffect(() => {
    const fetchConfig = async () => {
      if (!firestore || !activeId) return;
      try {
        const docRef = doc(firestore, 'institutions', activeId, 'configuracion_filtro', 'urls');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setBlacklist(snap.data().blacklist || []);
        }
      } catch (error) {
        console.error("Error cargando filtros:", error);
      }
    };
    fetchConfig();
  }, [activeId, firestore]);

  // Guardar configuración en la subcolección de la institución [cite: 2026-01-30]
  const saveConfig = async () => {
    if (!firestore || !activeId) return;
    setLoading(true);
    try {
      const docRef = doc(firestore, 'institutions', activeId, 'configuracion_filtro', 'urls');
      await setDoc(docRef, {
        blacklist,
        updatedAt: new Date(),
        lastUpdatedBy: 'admin' // Opcional: para auditoría
      });
      
      toast({ 
        title: "Sincronización Exitosa", 
        description: "Los filtros de EFAS ServiControlPro se han actualizado en todas las tablets." 
      });
    } catch (e) {
      console.error(e);
      toast({ 
        variant: "destructive", 
        title: "Error de Guardado", 
        description: "No se pudieron aplicar los cambios en Firestore." 
      });
    } finally {
      setLoading(false);
    }
  };

  const addUrl = () => {
    const formattedUrl = newUrl.trim().toLowerCase().replace(/^(https?:\/\/)/, "");
    if (formattedUrl && !blacklist.includes(formattedUrl)) {
      setBlacklist([...blacklist, formattedUrl]);
      setNewUrl('');
    }
  };

  const removeUrl = (urlToRemove: string) => {
    setBlacklist(blacklist.filter(url => url !== urlToRemove));
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-blue-100/50 border border-slate-100">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-4 rounded-2xl shadow-lg shadow-orange-200">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-950 uppercase italic tracking-tighter">
              Filtro de Contenido
            </h2>
            <p className="text-[10px] text-orange-600 font-black uppercase tracking-[0.2em]">
              Blacklist de Navegación
            </p>
          </div>
        </div>
        <div className="hidden md:block">
           <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
             ID: {activeId.substring(0,8)}...
           </span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="ejemplo: youtube.com o juegos.com" 
              value={newUrl} 
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              className="pl-12 bg-slate-50 border-slate-200 h-14 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <Button 
            onClick={addUrl} 
            className="h-14 px-8 bg-slate-800 hover:bg-black text-white rounded-2xl font-black uppercase tracking-tighter transition-all"
          >
            Añadir
          </Button>
        </div>

        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 min-h-[200px]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldAlert className="w-3 h-3" /> Sitios restringidos actualmente
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {blacklist.length === 0 ? (
              <div className="col-span-full py-10 text-center">
                <p className="text-sm font-bold text-slate-300 italic">No hay URLs bloqueadas. El acceso es libre.</p>
              </div>
            ) : (
              blacklist.map((url) => (
                <div key={url} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 group hover:border-red-200 transition-all">
                  <span className="text-sm font-black text-slate-600 truncate">{url}</span>
                  <button 
                    onClick={() => removeUrl(url)}
                    className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <Button 
          onClick={saveConfig} 
          disabled={loading || blacklist.length === 0}
          className="w-full bg-blue-950 hover:bg-slate-900 text-white py-8 rounded-[1.5rem] font-black shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 group"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Save className="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform" />
              <span className="text-lg uppercase italic tracking-tighter">
                Aplicar Cambios en <span className="text-orange-400">ServiControlPro</span>
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Pequeño componente Loader para el botón
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
