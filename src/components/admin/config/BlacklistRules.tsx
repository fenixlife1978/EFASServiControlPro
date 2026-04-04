'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue, set, push, remove, get } from 'firebase/database';
import { ShieldAlert, Plus, X, Loader2, Globe, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useInstitution } from '@/app/(admin)/dashboard/institution-context';
import { addToDenylist, removeFromDenylist } from '@/lib/nextdns';

interface BlacklistItem {
  id: string;
  domain: string;
  addedBy?: string;
  timestamp?: number;
  reason?: string;
  active: boolean;
}

/**
 * COMPONENTE: BlacklistRules
 * ESTADO: Por Sede (cada institución tiene su propia lista negra)
 * RUTA RTDB: config/instituciones/{InstitutoId}/blacklist
 * 
 * NOTA: La lista negra bloquea dominios específicos
 * AHORA TAMBIÉN SINCRONIZA CON NEXTDNS
 */
export function BlacklistRules() {
  const { institutionId } = useInstitution();
  const [sites, setSites] = useState<BlacklistItem[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [useBlacklist, setUseBlacklist] = useState(true);

  const inputStyle = "flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl text-white font-bold text-xs uppercase outline-none focus:border-red-500 transition-all";

  // Cargar configuración de blacklist de la sede actual
  useEffect(() => {
    if (!institutionId) return;

    // Escuchar blacklist de la sede
    const blacklistRef = ref(rtdb, `config/instituciones/${institutionId}/blacklist`);
    const useBlacklistRef = ref(rtdb, `config/instituciones/${institutionId}/useBlacklist`);
    
    const unsubscribeBlacklist = onValue(blacklistRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convertir objeto a array
        const domainsList: BlacklistItem[] = Object.entries(data).map(([key, value]: [string, any]) => {
          // Si el valor es un objeto con estructura completa o solo el dominio
          if (typeof value === 'string') {
            return {
              id: key,
              domain: value,
              active: true,
              timestamp: Date.now()
            };
          } else {
            return {
              id: key,
              domain: value.domain || key,
              addedBy: value.addedBy,
              timestamp: value.timestamp,
              reason: value.reason,
              active: value.active !== false
            };
          }
        });
        setSites(domainsList);
      } else {
        setSites([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error cargando blacklist:', error);
      setLoading(false);
    });

    const unsubscribeUseBlacklist = onValue(useBlacklistRef, (snapshot) => {
      setUseBlacklist(snapshot.exists() ? snapshot.val() : true);
    });

    return () => {
      unsubscribeBlacklist();
      unsubscribeUseBlacklist();
    };
  }, [institutionId]);

  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionId) {
      toast.error("No hay sede seleccionada");
      return;
    }
    if (!newDomain.trim()) return;

    const cleanDomain = newDomain.toLowerCase().trim()
      .replace(/^(https?:\/\/)/, '')
      .replace(/\/$/, '')
      .replace(/^www\./, '');

    if (!cleanDomain) return;

    setSaving(true);
    try {
      // 1. Guardar en RTDB (sistema actual)
      const blacklistRef = ref(rtdb, `config/instituciones/${institutionId}/blacklist`);
      const newItemRef = push(blacklistRef);
      await set(newItemRef, cleanDomain);
      
      // 2. Actualizar useBlacklist a true
      const useBlacklistRef = ref(rtdb, `config/instituciones/${institutionId}/useBlacklist`);
      await set(useBlacklistRef, true);
      
      // 3. Sincronizar con NextDNS
      try {
        const nextdnsSuccess = await addToDenylist(cleanDomain);
        if (nextdnsSuccess) {
          console.log(`✅ NextDNS: ${cleanDomain} bloqueado`);
        } else {
          console.warn(`⚠️ NextDNS: Error al bloquear ${cleanDomain}`);
          toast.warning(`Dominio guardado localmente, pero falló sincronización con NextDNS`);
        }
      } catch (nextdnsError) {
        console.error('Error en NextDNS:', nextdnsError);
        toast.warning(`Dominio guardado localmente, pero NextDNS no se actualizó`);
      }
      
      setNewDomain('');
      toast.success(`✅ Dominio ${cleanDomain} bloqueado (local + NextDNS)`);
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error("❌ Error al guardar en RTDB");
    } finally {
      setSaving(false);
    }
  };

  const removeDomain = async (domainId: string, domain: string) => {
    if (!institutionId) return;
    
    try {
      // 1. Eliminar de RTDB
      const domainRef = ref(rtdb, `config/instituciones/${institutionId}/blacklist/${domainId}`);
      await remove(domainRef);
      
      // 2. Sincronizar con NextDNS (desbloquear)
      try {
        const nextdnsSuccess = await removeFromDenylist(domain);
        if (nextdnsSuccess) {
          console.log(`✅ NextDNS: ${domain} desbloqueado`);
        } else {
          console.warn(`⚠️ NextDNS: Error al desbloquear ${domain}`);
        }
      } catch (nextdnsError) {
        console.error('Error en NextDNS:', nextdnsError);
      }
      
      toast.success(`✅ Dominio ${domain} desbloqueado (local + NextDNS)`);
    } catch (error) {
      console.error('Error removing domain:', error);
      toast.error("❌ Error al eliminar");
    }
  };

  const toggleUseBlacklist = async () => {
    if (!institutionId) return;
    
    try {
      const useBlacklistRef = ref(rtdb, `config/instituciones/${institutionId}/useBlacklist`);
      await set(useBlacklistRef, !useBlacklist);
      toast.success(`Filtro blacklist ${!useBlacklist ? 'activado' : 'desactivado'}`);
    } catch (error) {
      console.error('Error toggling blacklist:', error);
      toast.error("❌ Error al actualizar");
    }
  };

  if (!institutionId) {
    return (
      <div className="bg-[#0f1117] border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
        <div className="flex flex-col items-center justify-center py-20">
          <Building className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-[10px] font-black uppercase italic text-slate-500">
            Selecciona una sede para gestionar su lista negra
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#0f1117] border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-4" />
          <span className="text-[10px] font-black uppercase italic text-slate-500">
            Sincronizando Blacklist de sede {institutionId}...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1117] border border-slate-800 rounded-[3rem] p-10 shadow-2xl animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-red-500/10 p-3 rounded-2xl">
            <ShieldAlert className="text-red-500 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
              Navegación <span className="text-red-500">Bloqueada</span>
            </h2>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Lista Negra • Sede: {institutionId}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleUseBlacklist}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
              useBlacklist 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {useBlacklist ? '✓ BLACKLIST ACTIVA' : '⨯ BLACKLIST INACTIVA'}
          </button>
          <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800">
            <Globe className="w-3 h-3 text-red-500" />
            <span className="text-[8px] font-black text-slate-400 uppercase italic">
              {sites.length} reglas activas
            </span>
          </div>
        </div>
      </div>

      {!useBlacklist && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
          <p className="text-[10px] text-yellow-400 font-black uppercase text-center">
            ⚠️ LISTA NEGRA DESACTIVADA - No se aplicarán bloqueos de esta sede
          </p>
        </div>
      )}

      <form onSubmit={addDomain} className="flex gap-4 mb-10">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          className={inputStyle}
          placeholder="DOMINIO O PALABRA CLAVE (EJ: TIKTOK.COM, INSTAGRAM.COM)"
          disabled={saving}
        />
        <Button
          type="submit"
          disabled={saving || !newDomain.trim()}
          className="bg-red-600 hover:bg-red-500 text-white font-black h-auto px-8 rounded-xl text-[10px] uppercase italic transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5 mr-2" />}
          {saving ? 'Guardando...' : 'Bloquear'}
        </Button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
        {sites.length === 0 ? (
          <div className="col-span-2 py-16 text-center border border-dashed border-slate-800 rounded-[2rem]">
            <p className="text-slate-600 font-black uppercase italic text-xs">No hay dominios bloqueados</p>
            <p className="text-slate-700 text-[8px] mt-2">
              {useBlacklist 
                ? "Agrega un dominio para bloquearlo en esta sede"
                : "Activa la lista negra para comenzar a filtrar"
              }
            </p>
          </div>
        ) : (
          sites.map((site) => (
            <div
              key={site.id}
              className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                site.active && useBlacklist
                  ? 'bg-slate-900/40 border-red-900/30 hover:border-red-500/50' 
                  : 'bg-slate-900/20 border-slate-800/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-2 h-2 rounded-full ${site.active && useBlacklist ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-slate-600'}`} />
                <span className="text-xs font-black text-slate-200 uppercase italic tracking-tight">
                  {site.domain}
                </span>
                {!useBlacklist && (
                  <span className="text-[8px] text-yellow-500 uppercase font-bold ml-2">(BLACKLIST INACTIVA)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => removeDomain(site.id, site.domain)}
                  type="button"
                  className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Eliminar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800/50">
        <p className="text-[8px] text-slate-600 font-bold uppercase italic text-center leading-relaxed">
          {useBlacklist 
            ? "🚫 Los dominios en lista negra serán BLOQUEADOS en esta sede. Cada sede tiene su propia configuración."
            : "La lista negra está desactivada. Actívala para bloquear dominios específicos en esta sede."
          }
        </p>
      </div>
    </div>
  );
}