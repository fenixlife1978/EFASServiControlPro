'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tablet, UserCheck } from "lucide-react";

export function DirectorInventory({ data, type }: { data: any[], type: 'tablets' | 'profesores' }) {
  return (
    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="border-b border-slate-50">
        <CardTitle className="text-sm font-black uppercase italic flex items-center gap-2">
          {type === 'tablets' ? <Tablet className="w-4 h-4 text-orange-500" /> : <UserCheck className="w-4 h-4 text-orange-500" />}
          {type === 'tablets' ? 'Dispositivos en el Instituto' : 'Personal Docente'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase">ID</TableHead>
              <TableHead className="text-[10px] font-black uppercase">{type === 'tablets' ? 'Modelo' : 'Nombre'}</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, i) => (
              <TableRow key={i} className="hover:bg-slate-50/50">
                <TableCell className="text-xs font-bold text-slate-900">{item.codigo || item.id}</TableCell>
                <TableCell className="text-xs text-slate-500 font-medium">{item.modelo || item.nombre}</TableCell>
                <TableCell className="text-right">
                  <Badge className="bg-green-100 text-green-700 border-none text-[9px] font-black uppercase">
                    Vinculado
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
