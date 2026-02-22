'use client';

import React from 'react';
import { useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { ShieldAlert, Globe, Monitor, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function IncidentsTable({ institutionId }: { institutionId: string }) {
  // Escuchamos la subcolección de incidencias de la institución
  const { value: incidents, loading } = useCollection(`institutions/${institutionId}/incidencias`);

  const markAsResolved = async (id: string) => {
    await updateDocumentNonBlocking(`institutions/${institutionId}/incidencias`, id, {
      status: 'visto',
      resolvedAt: new Date()
    });
  };

  const deleteIncident = async (id: string) => {
    if(confirm("¿Eliminar registro de infracción?")) {
        await deleteDocumentNonBlocking(`institutions/${institutionId}/incidencias`, id);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-orange-500 font-black italic">ESCANEANDO RED...</div>;

  return (
    <div className="bg-[#0f1117] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
        <div>
          <h2 className="text-lg font-black italic text-white uppercase flex items-center gap-2">
            <ShieldAlert className="text-orange-500 w-5 h-5" /> Registro de Infracciones
          </h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Monitoreo de seguridad EDU</p>
        </div>
      </div>

      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {incidents.length === 0 ? (
          <div className="p-16 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
            Sistema Limpio - Sin Incidencias
          </div>
        ) : (
          incidents.map((inc: any) => (
            <div key={inc.id} className={`p-5 flex items-center justify-between transition-all ${inc.status === 'visto' ? 'opacity-30' : 'bg-orange-500/5'}`}>
              <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-3 rounded-2xl text-orange-500 shadow-inner">
                  {inc.tipo === 'URL' ? <Globe className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-white font-black text-sm uppercase">
                    {inc.estudianteNombre} 
                    <span className="text-orange-500/50 font-black ml-2 text-[10px]">[{inc.grado || 'S/G'}]</span>
                  </p>
                  <p className="text-slate-400 text-xs font-medium italic mb-1">{inc.detalle}</p>
                  <span className="text-[9px] text-slate-600 flex items-center gap-1 font-bold">
                    <Clock className="w-3 h-3" /> RECIENTE
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                {inc.status !== 'visto' && (
                    <Button 
                        onClick={() => markAsResolved(inc.id)}
                        className="bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white text-[10px] font-black rounded-xl h-8 border border-orange-600/20"
                    >
                        VISTO
                    </Button>
                )}
                <Button 
                    onClick={() => deleteIncident(inc.id)}
                    variant="ghost"
                    size="icon"
                    className="text-slate-700 hover:text-red-500 h-8 w-8"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}