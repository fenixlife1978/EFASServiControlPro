'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Save, Trash2, Globe, Lock, Power, ListChecks, ListX, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

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
          if (data.useWhitelist) setFilterMode('whitelist');
        }
      } catch (error) {
        console.error("Error cargando base de datos:", error);
      }
    };
    fetchConfig();
  }, [activeId, firestore]);

  const saveConfig = async () => {
    if (!firestore || !activeId) return;
    setLoading(true);
    try {
      const instRef = doc(firestore, 'institutions', activeId);
      
      const updateData = {
        blacklist,
        whitelist,
        useBlacklist,
        useWhitelist,
        updatedAt: new Date(),
        lastUpdatedBy: 'EDUControl_Admin'
      };

      await updateDoc(instRef, updateData);
      
      toast({ 
        title: "✅ SISTEMA ACTUALIZADO", 
        description: "Las políticas de EDUControlPro han sido desplegadas con éxito." 
      });
    } catch (e) {
      console.error(e);
      toast({ 
        variant: "destructive", 
        title: "❌ ERROR DE RED", 
        description: "No se pudo sincronizar con el núcleo de EDUControlPro." 
      });
    } finally {
      setLoading(false);
    }
  };

  const addUrl = () => {
    const formattedUrl = newUrl.trim().toLowerCase()
      .replace(/^(https?:\/\/)/, "")
      .replace(/\/$/, "");

    if (!formattedUrl || formattedUrl.length < 3) return;
    
    if (filterMode === 'blacklist') {
      if (!blacklist.includes(formattedUrl)) setBlacklist([...blacklist, formattedUrl]);
    } else {
      if (!whitelist.includes(formattedUrl)) setWhitelist([...whitelist, formattedUrl]);
    }
    setNewUrl('');
  };

  const removeUrl = (urlToRemove: string) => {
    if (filterMode === 'blacklist') {
      setBlacklist(blacklist.filter(url => url !== urlToRemove));
    } else {
      setWhitelist(whitelist.filter(url => url !== urlToRemove));
    }
  };

  return (
    <div className="bg-[#0f1117] rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 text-white transition-all">
      {/* Header EDUControlPro */}
      <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-4 rounded-2xl shadow-lg shadow-orange-500/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">
              Filtro <span className="text-orange-500">Web</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2">
              Panel de Control <span className="text-orange-500/80 italic">EDUControlPro</span>
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-slate-800 text-slate-500 font-mono text-[9px] px-3">
          SECURE_ID: {activeId.slice(0, 8).toUpperCase()}
        </Badge>
      </div>

      {/* Selectores de Modo */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { id: 'blacklist', label: 'Lista Negra', icon: ListX, color: 'red', desc: 'Bloqueo Específico' },
          { id: 'whitelist', label: 'Lista Blanca', icon: ListChecks, color: 'green', desc: 'Acceso Exclusivo' }
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => setFilterMode(mode.id as any)}
            className={`p-5 rounded-[2rem] border-2 flex flex-col items-center gap-2 transition-all duration-300 group ${
              filterMode === mode.id 
                ? `border-${mode.color}-500 bg-${mode.color}-500/10 text-${mode.color}-500` 
                : 'border-slate-800 bg-slate-900/30 text-slate-500 opacity-60 hover:opacity-100'
            }`}
          >
            <mode.icon className="w-6 h-6 transition-transform group-hover:scale-110" />
            <span className="text-[11px] font-black uppercase tracking-tight">{mode.label}</span>
            <span className="text-[8px] font-bold opacity-60 uppercase italic">{mode.desc}</span>
          </button>
        ))}
      </div>

      {/* Switch Maestro */}
      <div className={`flex items-center justify-between p-5 rounded-[2.2rem] border transition-all duration-500 mb-8 ${
        (filterMode === 'blacklist' ? useBlacklist : useWhitelist) 
          ? 'bg-green-500/5 border-green-500/20 shadow-inner' 
          : 'bg-slate-950/50 border-slate-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl transition-all ${
            (filterMode === 'blacklist' ? useBlacklist : useWhitelist) ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-800 text-slate-500'
          }`}>
            <Power className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase italic leading-none">
              Estado del Escudo {filterMode === 'blacklist' ? 'Negro' : 'Blanco'}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
              {(filterMode === 'blacklist' ? useBlacklist : useWhitelist) ? 'EDUControlPro Protección ON' : 'Filtro en Standby'}
            </p>
          </div>
        </div>
        <Switch 
          checked={filterMode === 'blacklist' ? useBlacklist : useWhitelist}
          onCheckedChange={(checked) => {
            if (filterMode === 'blacklist') {
              setUseBlacklist(checked);
              if (checked) setUseWhitelist(false);
            } else {
              setUseWhitelist(checked);
              if (checked) setUseBlacklist(false);
            }
          }}
          className="data-[state=checked]:bg-green-500"
        />
      </div>

      <div className="space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder={filterMode === 'blacklist' ? "DOMINIO A RESTRINGIR" : "DOMINIO A AUTORIZAR"} 
              value={newUrl} 
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              className="pl-14 bg-slate-950 border-slate-800 h-14 rounded-2xl font-bold text-white focus:ring-2 focus:ring-orange-500/20 uppercase text-xs"
            />
          </div>
          <Button 
            onClick={addUrl} 
            className="h-14 px-10 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase italic shadow-lg shadow-orange-500/20"
          >
            Añadir
          </Button>
        </div>

        {/* Lista de Dominios */}
        <div className="bg-slate-950/50 rounded-[2.5rem] p-6 border border-slate-800 min-h-[250px] relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6 ml-2">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Monitor de Dominios de EDUControlPro
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(filterMode === 'blacklist' ? blacklist : whitelist).length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <p className="text-[10px] font-black text-slate-700 uppercase italic">
                  No hay registros en la base de datos local
                </p>
              </div>
            ) : (
              (filterMode === 'blacklist' ? blacklist : whitelist).map((url) => (
                <div key={url} className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800 group hover:border-orange-500/40 transition-all">
                  <span className="text-xs font-bold text-slate-400 truncate tracking-tight lowercase">{url}</span>
                  <button 
                    onClick={() => removeUrl(url)}
                    className="p-2 hover:bg-red-500/10 rounded-xl text-slate-600 hover:text-red-500 transition-all"
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
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-8 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-4 group"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          ) : (
            <>
              <Save className="w-5 h-5 text-blue-200 group-hover:scale-110 transition-transform" />
              Sincronizar Políticas EDUControlPro
            </>
          )}
        </Button>
      </div>
    </div>
  );
}