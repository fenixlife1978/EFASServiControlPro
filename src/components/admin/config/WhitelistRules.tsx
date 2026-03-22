'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { ShieldCheck, Plus, X, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * COMPONENTE: WhitelistRules
 * ESTADO: Global (Independiente de la Sede)
 * RUTA FIRESTORE: configuracion_global/whitelist
 */
export function WhitelistRules() {
  const [sites, setSites] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const inputStyle = "flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase outline-none focus:border-orange-500 transition-all";

  useEffect(() => {
    // Apuntamos a la colección configuracion_global en Firestore
    const whitelistDocRef = doc(db, 'configuracion_global', 'whitelist');
    
    const unsubscribe = onSnapshot(whitelistDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Leemos el array 'dominios' que usa Android (o 'domains')
        const dominios = data.dominios || data.domains || [];
        setSites(dominios);
      } else {
        setSites([]);
        // Si no existe, lo creamos para evitar errores de actualización
        setDoc(whitelistDocRef, { dominios: [] }).catch(console.error);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    
    const cleanUrl = newUrl.toLowerCase().trim()
      .replace(/^(https?:\/\/)/, '')
      .replace(/\/$/, '');

    try {
      const whitelistDocRef = doc(db, 'configuracion_global', 'whitelist');
      await updateDoc(whitelistDocRef, {
        dominios: arrayUnion(cleanUrl)
      });
      setNewUrl('');
      toast.success("DOMINIO AÑADIDO A LA LISTA BLANCA (FIRESTORE)");
    } catch (error) {
      console.error(error);
      toast.error("ERROR AL GUARDAR EN NUBE");
    }
  };

  const removeUrl = async (domain: string) => {
    try {
      const whitelistDocRef = doc(db, 'configuracion_global', 'whitelist');
      await updateDoc(whitelistDocRef, {
        dominios: arrayRemove(domain)
      });
      toast.success("REGLA ELIMINADA");
    } catch (error) {
      toast.error("ERROR AL ELIMINAR");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#0f1117] rounded-[2.5rem] border border-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" />
        <span className="text-[10px] font-black uppercase italic text-slate-500">Sincronizando Whitelist...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-[3rem] p-10 shadow-2xl animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500/10 p-3 rounded-2xl">
            <ShieldCheck className="text-emerald-500 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
              Navegación <span className="text-emerald-500 font-light text-xl">Permitida</span>
            </h2>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Filtro de Seguridad Global / Whitelist</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800">
          <Globe className="w-3 h-3 text-emerald-500" />
          <span className="text-[8px] font-black text-slate-400 uppercase italic">Estado: Maestro Firestore</span>
        </div>
      </div>

      <form onSubmit={addUrl} className="flex gap-4 mb-10">
        <input 
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className={inputStyle}
          placeholder="DOMINIO O PALABRA CLAVE (EJ: EDU.COM)"
        />
        <Button 
          type="submit" 
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black h-auto px-8 rounded-xl text-[10px] uppercase italic transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-5 h-5 mr-2" /> Añadir
        </Button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
        {sites.length === 0 ? (
          <div className="col-span-2 py-16 text-center border border-dashed border-slate-800 rounded-[2rem]">
            <p className="text-slate-600 font-black uppercase italic text-xs">No hay dominios autorizados todavía</p>
          </div>
        ) : (
          sites.map((site) => (
            <div 
              key={site} 
              className="flex items-center justify-between bg-slate-900/40 p-5 rounded-2xl border border-slate-800 group hover:border-emerald-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-xs font-black text-slate-200 uppercase italic tracking-tight">
                  {site}
                </span>
              </div>
              <button 
                onClick={() => removeUrl(site)} 
                type="button"
                className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                title="Eliminar regla"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800/50">
        <p className="text-[8px] text-slate-600 font-bold uppercase italic text-center leading-relaxed">
          Cualquier cambio en esta lista afectará en tiempo real a todas las unidades <br />
          vinculadas al sistema EFAS ServiControlPro. (Reglas Firestore)
        </p>
      </div>
    </div>
  );
}