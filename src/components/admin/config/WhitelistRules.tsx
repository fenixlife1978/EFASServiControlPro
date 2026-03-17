'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, push, remove } from 'firebase/database';
import { Globe, Plus, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function WhitelistRules() {
  const [sites, setSites] = useState<{ id: string; url: string }[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const whitelistRef = ref(rtdb, 'global/whitelist');
    const unsubscribe = onValue(whitelistRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convertir el objeto de Firebase (con claves como -Nxxx) a un array
        const sitesArray = Object.keys(data).map(key => ({
          id: key,
          url: data[key]
        }));
        setSites(sitesArray);
      } else {
        setSites([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const cleanUrl = newUrl.toLowerCase().trim();

    try {
      const whitelistRef = ref(rtdb, 'global/whitelist');
      await push(whitelistRef, cleanUrl);
      setNewUrl('');
      toast({ title: "Lista Blanca actualizada", description: "Sitio permitido añadido." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al añadir sitio" });
    }
  };

  const removeUrl = async (id: string) => {
    try {
      await remove(ref(rtdb, `global/whitelist/${id}`));
    } catch (error) {
      toast({ variant: "destructive", title: "Error al eliminar sitio" });
    }
  };

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="text-emerald-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">
          Lista Blanca <span className="text-emerald-500">(Sitios Permitidos)</span>
        </h2>
      </div>

      <form onSubmit={addUrl} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full bg-[#1c212c] rounded-2xl py-4 pl-12 pr-4 text-[10px] font-bold uppercase text-white border border-white/5 focus:border-emerald-500 outline-none transition-all"
            placeholder="EJ: WIKIPEDIA.ORG"
          />
        </div>
        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl px-6 h-auto">
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
        {sites.length === 0 ? (
          <p className="text-[9px] text-slate-600 font-black uppercase text-center py-8 italic tracking-widest">
            No hay reglas de excepción
          </p>
        ) : (
          sites.map((site) => (
            <div key={site.id} className="flex items-center justify-between bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
              <span className="text-[10px] font-black text-emerald-200 uppercase italic tracking-wider">{site.url}</span>
              <button 
                onClick={() => removeUrl(site.id)} 
                className="text-slate-600 hover:text-red-500 p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}