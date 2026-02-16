'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ShieldCheck, Plus, X, Globe, Lock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function SecurityRules({ institutionId }: { institutionId: string }) {
  const [rules, setRules] = useState<{ blacklisted_urls: string[] }>({ blacklisted_urls: [] });
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Suscribirse a las reglas de la institución
  useEffect(() => {
    const docRef = doc(db, `institutions/${institutionId}/config`, 'security_rules');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setRules(snapshot.data() as any);
      } else {
        // Si no existe, creamos el documento inicial
        setDoc(docRef, { blacklisted_urls: [] });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [institutionId]);

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    try {
      const docRef = doc(db, `institutions/${institutionId}/config`, 'security_rules');
      await updateDoc(docRef, {
        blacklisted_urls: arrayUnion(newUrl.toLowerCase().trim())
      });
      setNewUrl('');
      toast({ title: "Lista actualizada", description: "URL bloqueada correctamente." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo añadir." });
    }
  };

  const removeUrl = async (url: string) => {
    try {
      const docRef = doc(db, `institutions/${institutionId}/config`, 'security_rules');
      await updateDoc(docRef, {
        blacklisted_urls: arrayRemove(url)
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 font-black italic">CARGANDO REGLAS...</div>;

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Lock className="text-orange-500 w-6 h-6" />
          <h2 className="text-xl font-black italic uppercase text-white">Filtro de Contenido</h2>
        </div>
        <span className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[10px] font-black border border-orange-500/20">
          PROTECCIÓN ACTIVA
        </span>
      </div>

      {/* Formulario para añadir URL */}
      <form onSubmit={addUrl} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full bg-[#1c212c] rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500 border border-white/5"
            placeholder="Ej: facebook.com o palabras clave"
          />
        </div>
        <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-black italic rounded-2xl px-6">
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      {/* Listado de URLs bloqueadas */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
        <p className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-4 tracking-widest">Lista Negra Actual</p>
        
        {rules.blacklisted_urls.length === 0 ? (
          <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
            <p className="text-slate-600 text-xs font-bold uppercase italic">No hay restricciones activas</p>
          </div>
        ) : (
          rules.blacklisted_urls.map((url, index) => (
            <div key={index} className="flex items-center justify-between bg-[#1c212c] p-4 rounded-2xl border border-white/5 group hover:border-orange-500/30 transition-all">
              <span className="text-sm font-mono text-slate-300 font-bold">{url}</span>
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

      <div className="mt-8 pt-6 border-t border-white/5">
        <p className="text-[9px] text-slate-600 font-bold leading-tight uppercase italic">
          * Cualquier intento de acceso a estos dominios activará la pantalla de bloqueo y enviará una incidencia al panel principal de EFAS ServiControlPro.
        </p>
      </div>
    </div>
  );
}