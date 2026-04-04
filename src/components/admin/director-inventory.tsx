'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tablet, UserCheck, Shield } from "lucide-react";

export function DirectorInventory({ data, type }: { data: any[], type: 'tablets' | 'profesores' }) {
  return (
    <Card className="border-none shadow-none bg-transparent overflow-hidden">
      <CardHeader className="px-6 py-4 border-b border-slate-100 bg-white/50">
        <CardTitle className="text-[11px] font-black uppercase italic tracking-widest flex items-center gap-3 text-slate-800">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            {type === 'tablets' ? (
              <Tablet className="w-4 h-4 text-orange-600" />
            ) : (
              <UserCheck className="w-4 h-4 text-orange-600" />
            )}
          </div>
          {type === 'tablets' ? 'Inventario de Dispositivos' : 'Nómina de Docentes'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0 bg-white">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="text-[9px] font-black uppercase text-slate-400 pl-6">Identificador</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-400">
                {type === 'tablets' ? 'Modelo / Hardware' : 'Nombre Completo'}
              </TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-400 text-right pr-6">Estado de Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((item, i) => (
                <TableRow key={i} className="group hover:bg-slate-50/80 transition-colors border-slate-100">
                  <TableCell className="pl-6">
                    <span className="text-[10px] font-black font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded">
                      {item.codigo || item.id}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 uppercase italic">
                        {item.modelo || item.nombre}
                      </span>
                      {type === 'tablets' && (
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                          Android Enterprise Ready
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Badge 
                      className={`
                        border-none text-[8px] font-black uppercase italic px-3 py-1 rounded-full
                        ${item.estado === 'online' || !item.estado 
                          ? 'bg-green-100 text-green-600 shadow-sm shadow-green-100' 
                          : 'bg-slate-100 text-slate-400'}
                      `}
                    >
                      {item.estado === 'online' || !item.estado ? (
                        <span className="flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Activo
                        </span>
                      ) : 'Desconectado'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase italic">
                    No se encontraron registros en la base de datos
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
