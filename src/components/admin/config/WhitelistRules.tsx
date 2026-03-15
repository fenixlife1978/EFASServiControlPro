'use client';

import React, { useState, useEffect } from 'react';
import { db, rtdb } from '@/firebase/config'; // Importación de rtdb asegurada
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { ref, update } from 'firebase/database'; // Métodos de RTDB añadidos
import { CheckCircle, Plus, X, Globe, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function WhitelistRules({ institutionId }: { institutionId: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const docRef = doc(db, `institutions/${institutionId}/config`, 'whitelist_rules');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setUrls(snapshot.data().allowed_urls || []);
      } else {
        setDoc(docRef, { allowed_urls: [] });
      }
    });
    return () => unsubscribe();
  }, [institutionId]);

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    const cleanUrl = newUrl.toLowerCase().trim();

    try {
      // 1. Actualización en Firestore (Tu lógica original)
      const docRef = doc(db, `institutions/${institutionId}/config`, 'whitelist_rules');
      await updateDoc(docRef, { allowed_urls: arrayUnion(cleanUrl) });

      // 2. Sincronización con RTDB para respuesta en tiempo real
      // Propagamos la lista completa actualizada al nodo de reglas
      await update(ref(rtdb, `config/instituciones/${institutionId}/rules`), {
        whitelist: [...urls, cleanUrl],
        lastUpdate: new Date().toISOString()
      });

      setNewUrl('');
      toast({ title: "Lista Blanca actualizada", description: "Sitio permitido añadido." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const removeUrl = async (url: string) => {
    try {
      // 1. Eliminación en Firestore
      const docRef = doc(db, `institutions/${institutionId}/config`, 'whitelist_rules');
      await updateDoc(docRef, { allowed_urls: arrayRemove(url) });

      // 2. Sincronización con RTDB
      const updatedList = urls.filter(u => u !== url);
      await update(ref(rtdb, `config/instituciones/${institutionId}/rules`), {
        whitelist: updatedList,
        lastUpdate: new Date().toISOString()
      });

    } catch (error) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="text-emerald-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">Lista Blanca <span className="text-emerald-500">(Sitios Permitidos)</span></h2>
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
        {urls.length === 0 ? (
          <p className="text-[9px] text-slate-600 font-black uppercase text-center py-8 italic tracking-widest">No hay reglas de excepción</p>
        ) : (
          urls.map((url, index) => (
            <div key={index} className="flex items-center justify-between bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
              <span className="text-[10px] font-black text-emerald-200 uppercase italic tracking-wider">{url}</span>
              <button 
                onClick={() => removeUrl(url)} 
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