'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
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
    try {
      const docRef = doc(db, `institutions/${institutionId}/config`, 'whitelist_rules');
      await updateDoc(docRef, { allowed_urls: arrayUnion(newUrl.toLowerCase().trim()) });
      setNewUrl('');
      toast({ title: "Lista Blanca actualizada", description: "Sitio permitido añadido." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const removeUrl = async (url: string) => {
    const docRef = doc(db, `institutions/${institutionId}/config`, 'whitelist_rules');
    await updateDoc(docRef, { allowed_urls: arrayRemove(url) });
  };

  return (
    <div className="bg-[#11141d] border border-white/5 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="text-emerald-500 w-6 h-6" />
        <h2 className="text-xl font-black italic uppercase text-white">Lista Blanca (Sitios Permitidos)</h2>
      </div>

      <form onSubmit={addUrl} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full bg-[#1c212c] rounded-2xl py-4 pl-12 pr-4 text-sm text-white border border-white/5"
            placeholder="Ej: wikipedia.org"
          />
        </div>
        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl px-6">
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
        {urls.map((url, index) => (
          <div key={index} className="flex items-center justify-between bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
            <span className="text-xs font-bold text-emerald-200">{url}</span>
            <button onClick={() => removeUrl(url)} className="text-slate-500 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}