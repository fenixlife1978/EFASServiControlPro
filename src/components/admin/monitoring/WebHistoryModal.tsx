'use client';
import React, { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { X, Globe, Clock, ExternalLink, ShieldAlert } from 'lucide-react';

interface WebHistory {
  id: string;
  url: string;
  timestamp: any;
}

interface WebHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabletId: string;
  alumnoNombre: string;
}

export function WebHistoryModal({ isOpen, onClose, tabletId, alumnoNombre }: WebHistoryModalProps) {
  const [history, setHistory] = useState<WebHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !tabletId) return;

    setLoading(true);
    // Buscamos en la colección 'web_history' filtrando por la tablet específica
    const q = query(
      collection(db, 'web_history'),
      where('tabletId', '==', tabletId),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WebHistory[];
      setHistory(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, tabletId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d23] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Globe className="text-orange-500 w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight">Historial de Navegación</h3>
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Alumno: {alumnoNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-sm">Consultando Centinela...</p>
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:text-orange-500 group-hover:bg-orange-500/10 transition-colors">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm text-slate-200 font-medium truncate group-hover:text-white">{item.url}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {item.timestamp?.toDate().toLocaleString() || 'Fecha no disponible'}
                      </p>
                    </div>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="w-12 h-12 text-slate-700 mb-4" />
              <p className="text-slate-400 font-medium">No se detectaron registros recientes.</p>
              <p className="text-slate-600 text-xs mt-1">El sistema Centinela no ha reportado actividad para este dispositivo.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/20 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">EFAS ServiControlPro - Monitoreo en Tiempo Real</p>
        </div>
      </div>
    </div>
  );
}
