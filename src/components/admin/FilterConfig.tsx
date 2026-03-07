'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase'; 
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Save, Trash2, Globe, Lock, Power, ListChecks, ListX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

export default function FilterConfig({ activeId }: { activeId: string }) {
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [filterMode, setFilterMode] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [useBlacklist, setUseBlacklist] = useState(false);
  const [useWhitelist, setUseWhitelist] = useState(false);
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  // Cargar configuración existente DESDE EL DOCUMENTO PRINCIPAL de la institución
  useEffect(() => {
    const fetchConfig = async () => {
      if (!firestore || !activeId) return;
      try {
        const instRef = doc(firestore, 'institutions', activeId);
        const snap = await getDoc(instRef);
        if (snap.exists()) {
          const data = snap.data();
          setBlacklist(data.blacklist || []);
          setWhitelist(data.whitelist || []);
          setUseBlacklist(data.useBlacklist || false);
          setUseWhitelist(data.useWhitelist || false);
        }
      } catch (error) {
        console.error("Error cargando filtros:", error);
      }
    };
    fetchConfig();
  }, [activeId, firestore]);

  // Guardar configuración EN EL DOCUMENTO PRINCIPAL de la institución
  const saveConfig = async () => {
    if (!firestore || !activeId) return;
    setLoading(true);
    try {
      const instRef = doc(firestore, 'institutions', activeId);
      
      // Actualizar según el modo activo
      if (filterMode === 'blacklist') {
        await updateDoc(instRef, {
          blacklist: blacklist,
          useBlacklist: useBlacklist,
          updatedAt: new Date(),
          lastUpdatedBy: 'admin'
        });
      } else {
        await updateDoc(instRef, {
          whitelist: whitelist,
          useWhitelist: useWhitelist,
          updatedAt: new Date(),
          lastUpdatedBy: 'admin'
        });
      }
      
      toast({ 
        title: "✅ Filtros Actualizados", 
        description: "Los cambios se han aplicado a todas las tablets de la institución." 
      });
    } catch (e) {
      console.error(e);
      toast({ 
        variant: "destructive", 
        title: "❌ Error de Guardado", 
        description: "No se pudieron aplicar los cambios." 
      });
    } finally {
      setLoading(false);
    }
  };

  const addUrl = () => {
    const formattedUrl = newUrl.trim().toLowerCase().replace(/^(https?:\/\/)/, "");
    if (!formattedUrl) return;
    
    if (filterMode === 'blacklist') {
      if (!blacklist.includes(formattedUrl)) {
        setBlacklist([...blacklist, formattedUrl]);
        setNewUrl('');
      }
    } else {
      if (!whitelist.includes(formattedUrl)) {
        setWhitelist([...whitelist, formattedUrl]);
        setNewUrl('');
      }
    }
  };

  const removeUrl = (urlToRemove: string) => {
    if (filterMode === 'blacklist') {
      setBlacklist(blacklist.filter(url => url !== urlToRemove));
    } else {
      setWhitelist(whitelist.filter(url => url !== urlToRemove));
    }
  };

  return (
    <div className="bg-[#0f1117] rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 text-white">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-4 rounded-2xl shadow-lg shadow-orange-500/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
              Filtro de Contenido
            </h2>
            <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.2em]">
              Control de Navegación
            </p>
          </div>
        </div>
      </div>

      {/* Selector de modo: Blacklist / Whitelist */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setFilterMode('blacklist')}
          className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
            filterMode === 'blacklist' 
              ? 'border-red-500 bg-red-500/10 text-red-500' 
              : 'border-slate-800 bg-slate-900/50 text-slate-400'
          }`}
        >
          <ListX className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase">Lista Negra</span>
          <span className="text-[8px] text-slate-500">Bloquea sitios específicos</span>
        </button>
        <button
          onClick={() => setFilterMode('whitelist')}
          className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
            filterMode === 'whitelist' 
              ? 'border-green-500 bg-green-500/10 text-green-500' 
              : 'border-slate-800 bg-slate-900/50 text-slate-400'
          }`}
        >
          <ListChecks className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase">Lista Blanca</span>
          <span className="text-[8px] text-slate-500">Solo permite sitios específicos</span>
        </button>
      </div>

      {/* Switch para activar/desactivar el filtro */}
      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <Power className={`w-5 h-5 ${filterMode === 'blacklist' ? (useBlacklist ? 'text-green-500' : 'text-red-500') : (useWhitelist ? 'text-green-500' : 'text-red-500')}`} />
          <div>
            <p className="text-sm font-black text-white uppercase italic">
              {filterMode === 'blacklist' ? 'Filtro de Lista Negra' : 'Filtro de Lista Blanca'}
            </p>
            <p className="text-[8px] text-slate-500">
              {filterMode === 'blacklist' 
                ? (useBlacklist ? 'Activado: Se bloquean los sitios de la lista' : 'Desactivado: No se bloquean sitios')
                : (useWhitelist ? 'Activado: Solo se permiten los sitios de la lista' : 'Desactivado: Se permite cualquier sitio')}
            </p>
          </div>
        </div>
        <Switch 
          checked={filterMode === 'blacklist' ? useBlacklist : useWhitelist}
          onCheckedChange={(checked) => {
            if (filterMode === 'blacklist') {
              setUseBlacklist(checked);
              setUseWhitelist(false); // No pueden estar ambos activos
            } else {
              setUseWhitelist(checked);
              setUseBlacklist(false);
            }
          }}
        />
      </div>

      <div className="space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder={filterMode === 'blacklist' ? "ej: youtube.com, tiktok.com" : "ej: classroom.google.com, wikipedia.org"} 
              value={newUrl} 
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              className="pl-12 bg-slate-900 border-slate-800 h-14 rounded-2xl font-bold text-white outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          <Button 
            onClick={addUrl} 
            className="h-14 px-8 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-tighter transition-all"
          >
            Añadir
          </Button>
        </div>

        <div className="bg-slate-900/30 rounded-3xl p-6 border border-slate-800 min-h-[200px]">
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldAlert className="w-3 h-3" /> 
            {filterMode === 'blacklist' ? 'Sitios bloqueados' : 'Sitios permitidos'}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(filterMode === 'blacklist' ? blacklist : whitelist).length === 0 ? (
              <div className="col-span-full py-10 text-center">
                <p className="text-sm font-bold text-slate-500 italic">
                  {filterMode === 'blacklist' 
                    ? 'No hay sitios bloqueados. El acceso es libre.' 
                    : 'No hay sitios en lista blanca. Todos los sitios están bloqueados si el filtro está activo.'}
                </p>
              </div>
            ) : (
              (filterMode === 'blacklist' ? blacklist : whitelist).map((url) => (
                <div key={url} className="flex justify-between items-center bg-slate-900/70 p-4 rounded-2xl border border-slate-700 group hover:border-orange-500/30 transition-all">
                  <span className="text-sm font-black text-slate-300 truncate">{url}</span>
                  <button 
                    onClick={() => removeUrl(url)}
                    className="p-2 hover:bg-red-500/20 rounded-xl text-slate-500 hover:text-red-500 transition-all"
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
          disabled={loading || (filterMode === 'blacklist' ? blacklist.length === 0 && useBlacklist : whitelist.length === 0 && useWhitelist)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5 text-orange-300 group-hover:scale-110 transition-transform" />
              Aplicar Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
