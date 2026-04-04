'use client';

import { useState, useEffect, useCallback } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, update, set, get } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Save, Trash2, Globe, Lock, Power, ListChecks, ListX, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface FilterItem {
  id: string;
  value: string;
}

export default function FilterConfig({ activeId }: { activeId: string }) {
  const [blacklist, setBlacklist] = useState<FilterItem[]>([]);
  const [whitelist, setWhitelist] = useState<FilterItem[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [filterMode, setFilterMode] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [useBlacklist, setUseBlacklist] = useState(false);
  const [useWhitelist, setUseWhitelist] = useState(false);
  const [shieldEnabled, setShieldEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  // Normalizar dominio
  const normalizeDomain = useCallback((input: string): string => {
    if (!input) return '';
    return input.trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)/, '')
      .replace(/\/$/, '')
      .replace(/^www\./, '');
  }, []);

  // Generar ID seguro para Firebase (solo letras, números y guiones)
  const generateSafeId = useCallback((domain: string): string => {
    // Reemplazar caracteres no permitidos con guiones
    return domain
      .toLowerCase()
      .replace(/[.#$/[\]\s]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100); // Limitar longitud
  }, []);

  // Convertir datos de Firebase a array de items
  const convertToItems = useCallback((data: any): FilterItem[] => {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.map((value, index) => {
        const domain = normalizeDomain(value);
        return {
          id: generateSafeId(domain),
          value: domain
        };
      });
    }
    if (typeof data === 'object') {
      return Object.entries(data).map(([key, value]: [string, any]) => ({
        id: key,
        value: normalizeDomain(typeof value === 'string' ? value : value.domain || value)
      }));
    }
    return [];
  }, [normalizeDomain, generateSafeId]);

  // Convertir items a objeto para Firebase (usando IDs seguros)
  const convertToFirebaseObject = useCallback((items: FilterItem[]): any => {
    const obj: any = {};
    items.forEach((item) => {
      obj[item.id] = item.value;
    });
    return obj;
  }, []);

  // Verificar duplicados
  const isDuplicate = useCallback((domain: string): boolean => {
    const currentList = filterMode === 'blacklist' ? blacklist : whitelist;
    return currentList.some(item => item.value === domain);
  }, [filterMode, blacklist, whitelist]);

  // Cargar configuración
  useEffect(() => {
    if (!activeId) {
      setInitialLoading(false);
      return;
    }

    const configRef = ref(rtdb, `config/instituciones/${activeId}`);
    
    const unsubscribe = onValue(configRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setBlacklist(convertToItems(data.blacklist));
          setWhitelist(convertToItems(data.whitelist));
          setUseBlacklist(data.useBlacklist === true);
          setUseWhitelist(data.useWhitelist === true);
          setShieldEnabled(data.shieldModeGlobal === true);
        } else {
          set(configRef, {
            blacklist: {},
            whitelist: {},
            useBlacklist: false,
            useWhitelist: false,
            shieldModeGlobal: false,
            createdAt: Date.now()
          }).catch(console.error);
        }
      } catch (err) {
        console.error("Error procesando datos:", err);
      } finally {
        setInitialLoading(false);
      }
    }, (error) => {
      console.error("Error cargando configuración:", error);
      toast({ 
        variant: "destructive", 
        title: "Error de conexión", 
        description: "No se pudo conectar con el servidor de control." 
      });
      setInitialLoading(false);
    });

    return () => unsubscribe();
  }, [activeId, convertToItems, toast]);

  // Guardar configuración
  const saveConfig = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const configRef = ref(rtdb, `config/instituciones/${activeId}`);
      
      await update(configRef, {
        blacklist: convertToFirebaseObject(blacklist),
        whitelist: convertToFirebaseObject(whitelist),
        useBlacklist: useBlacklist,
        useWhitelist: useWhitelist,
        shieldModeGlobal: shieldEnabled,
        updatedAt: Date.now(),
        lastUpdatedBy: 'EDUControl_Admin'
      });

      toast({ 
        title: "✅ SISTEMA ACTUALIZADO", 
        description: "Las políticas han sido desplegadas en tiempo real." 
      });
    } catch (e) {
      console.error(e);
      toast({ 
        variant: "destructive", 
        title: "❌ ERROR DE RED", 
        description: "No se pudo sincronizar con el servidor." 
      });
    } finally {
      setLoading(false);
    }
  }, [activeId, blacklist, whitelist, useBlacklist, useWhitelist, shieldEnabled, convertToFirebaseObject, toast]);

  // Agregar URL
  const addUrl = useCallback(() => {
    if (!newUrl.trim()) {
      toast({ 
        variant: "destructive", 
        title: "Campo vacío", 
        description: "Ingresa un dominio para agregar." 
      });
      return;
    }

    const formattedUrl = normalizeDomain(newUrl);

    if (formattedUrl.length < 3) {
      toast({ 
        variant: "destructive", 
        title: "Dominio inválido", 
        description: "El dominio debe tener al menos 3 caracteres." 
      });
      return;
    }
    
    if (isDuplicate(formattedUrl)) {
      toast({ 
        variant: "destructive", 
        title: "⚠️ DOMINIO DUPLICADO", 
        description: `"${formattedUrl}" ya existe en la lista.` 
      });
      return;
    }
    
    const safeId = generateSafeId(formattedUrl);
    const newItem: FilterItem = { id: safeId, value: formattedUrl };
    
    if (filterMode === 'blacklist') {
      setBlacklist(prev => [...prev, newItem]);
    } else {
      setWhitelist(prev => [...prev, newItem]);
    }
    
    setNewUrl('');
    toast({ 
      title: "✅ Dominio agregado", 
      description: `"${formattedUrl}" añadido a la lista.` 
    });
  }, [newUrl, filterMode, normalizeDomain, generateSafeId, isDuplicate, toast]);

  // Eliminar URL
  const removeUrl = useCallback((itemId: string, itemValue: string) => {
    if (filterMode === 'blacklist') {
      setBlacklist(prev => prev.filter(item => item.id !== itemId));
    } else {
      setWhitelist(prev => prev.filter(item => item.id !== itemId));
    }
    
    toast({ 
      title: "🗑️ Dominio eliminado", 
      description: `"${itemValue}" ha sido removido.` 
    });
  }, [filterMode, toast]);

  // Toggles
  const toggleShield = useCallback(() => {
    setShieldEnabled(prev => !prev);
  }, []);

  const toggleUseBlacklist = useCallback(() => {
    setUseBlacklist(prev => !prev);
    if (!useBlacklist) {
      setUseWhitelist(false);
    }
  }, [useBlacklist]);

  const toggleUseWhitelist = useCallback(() => {
    setUseWhitelist(prev => !prev);
    if (!useWhitelist) {
      setUseBlacklist(false);
    }
  }, [useWhitelist]);

  const currentList = filterMode === 'blacklist' ? blacklist : whitelist;
  const safeCurrentList = Array.isArray(currentList) ? currentList : [];

  if (initialLoading) {
    return (
      <div className="bg-[#0f1117] rounded-[2.5rem] p-8 shadow-2xl border border-slate-800">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" />
          <p className="text-[10px] font-black uppercase italic text-slate-500">
            Cargando configuración...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 text-white transition-all">
      {/* Header */}
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
          SECURE_ID: {activeId?.slice(0, 8).toUpperCase() || 'N/A'}
        </Badge>
      </div>

      {/* Selectores de Modo */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setFilterMode('blacklist')}
          className={`p-5 rounded-[2rem] border-2 flex flex-col items-center gap-2 transition-all duration-300 group ${
            filterMode === 'blacklist' 
              ? 'border-red-500 bg-red-500/10 text-red-500' 
              : 'border-slate-800 bg-slate-900/30 text-slate-500 opacity-60 hover:opacity-100'
          }`}
        >
          <ListX className="w-6 h-6 transition-transform group-hover:scale-110" />
          <span className="text-[11px] font-black uppercase tracking-tight">Lista Negra</span>
          <span className="text-[8px] font-bold opacity-60 uppercase italic">Bloqueo Específico</span>
        </button>
        <button
          onClick={() => setFilterMode('whitelist')}
          className={`p-5 rounded-[2rem] border-2 flex flex-col items-center gap-2 transition-all duration-300 group ${
            filterMode === 'whitelist' 
              ? 'border-green-500 bg-green-500/10 text-green-500' 
              : 'border-slate-800 bg-slate-900/30 text-slate-500 opacity-60 hover:opacity-100'
          }`}
        >
          <ListChecks className="w-6 h-6 transition-transform group-hover:scale-110" />
          <span className="text-[11px] font-black uppercase tracking-tight">Lista Blanca</span>
          <span className="text-[8px] font-bold opacity-60 uppercase italic">Acceso Exclusivo</span>
        </button>
      </div>

      {/* Controles de activación */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className={`flex-1 flex items-center justify-between p-5 rounded-[2.2rem] border transition-all duration-500 ${
          shieldEnabled ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-950/50 border-slate-800'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all ${shieldEnabled ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-white uppercase italic leading-none">ESCUDO NEGRO</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
                {shieldEnabled ? 'PROTECCIÓN ACTIVA' : 'FILTRO EN STANDBY'}
              </p>
            </div>
          </div>
          <Switch checked={shieldEnabled} onCheckedChange={toggleShield} className="data-[state=checked]:bg-green-500" />
        </div>

        {filterMode === 'blacklist' && (
          <div className={`flex-1 flex items-center justify-between p-5 rounded-[2.2rem] border transition-all duration-500 ${
            useBlacklist ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-950/50 border-slate-800'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl transition-all ${useBlacklist ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white uppercase italic leading-none">LISTA NEGRA</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
                  {useBlacklist ? 'BLOQUEO ACTIVO' : 'BLOQUEO INACTIVO'}
                </p>
              </div>
            </div>
            <Switch checked={useBlacklist} onCheckedChange={toggleUseBlacklist} className="data-[state=checked]:bg-red-500" />
          </div>
        )}

        {filterMode === 'whitelist' && (
          <div className={`flex-1 flex items-center justify-between p-5 rounded-[2.2rem] border transition-all duration-500 ${
            useWhitelist ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-950/50 border-slate-800'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl transition-all ${useWhitelist ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white uppercase italic leading-none">LISTA BLANCA</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
                  {useWhitelist ? 'MODO PERMISIVO' : 'MODO RESTRICTIVO'}
                </p>
              </div>
            </div>
            <Switch checked={useWhitelist} onCheckedChange={toggleUseWhitelist} className="data-[state=checked]:bg-green-500" />
          </div>
        )}
      </div>

      {/* Formulario de agregar */}
      <div className="space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder={filterMode === 'blacklist' ? "DOMINIO A RESTRINGIR (ej: instagram.com)" : "DOMINIO A AUTORIZAR (ej: wikipedia.org)"} 
              value={newUrl} 
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              className="pl-14 bg-slate-950 border-slate-800 h-14 rounded-2xl font-bold text-white focus:ring-2 focus:ring-orange-500/20 text-xs"
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
        <div className="bg-slate-950/50 rounded-[2.5rem] p-6 border border-slate-800 min-h-[250px]">
          <div className="flex items-center gap-2 mb-6 ml-2">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Monitor de Dominios
            </p>
            <Badge className="ml-auto bg-slate-800 text-[8px] text-slate-400">
              {safeCurrentList.length} registros
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safeCurrentList.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <p className="text-[10px] font-black text-slate-700 uppercase italic">
                  No hay registros
                </p>
                <p className="text-[8px] text-slate-600 mt-2">
                  Agrega dominios para {filterMode === 'blacklist' ? 'bloquear' : 'permitir'}
                </p>
              </div>
            ) : (
              safeCurrentList.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800 group hover:border-orange-500/40 transition-all">
                  <span className="text-xs font-bold text-slate-400 truncate tracking-tight lowercase">{item.value}</span>
                  <button 
                    onClick={() => removeUrl(item.id, item.value)}
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
              Sincronizar Políticas
            </>
          )}
        </Button>
        
        <p className="text-[8px] text-slate-600 text-center mt-4">
          Los cambios se sincronizan en tiempo real con todas las tablets vinculadas
        </p>
      </div>
    </div>
  );
}