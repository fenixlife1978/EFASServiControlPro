'use client';

import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import type { Institution } from '@/lib/firestore-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Switch } from '../ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Building } from 'lucide-react';
import { Button } from '../ui/button';

const InstitutionTableSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Institución</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i} className="border-slate-100">
                    <TableCell className="px-6 py-5"><div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-5 w-32" /></div></TableCell>
                    <TableCell className="px-6 py-5"><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="px-6 py-5"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-6 py-5"><div className="flex items-center justify-end gap-4"><Skeleton className="h-6 w-11 rounded-full" /><Skeleton className="h-5 w-24" /></div></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);

export function InstitutionList() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const institutionsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'institutions');
  }, [firestore]);

  const { data: institutions, isLoading } = useCollection<Institution>(institutionsRef);
  
  const handleStatusChange = (institutionId: string, isSuspended: boolean) => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar a la base de datos.' });
        return;
    };
    const institutionRef = doc(firestore, 'institutions', institutionId);
    updateDocumentNonBlocking(institutionRef, {
      superAdminSuspended: isSuspended,
    });
    toast({ title: 'Estado actualizado', description: `La institución ha sido ${isSuspended ? 'desactivada' : 'activada'}.` });
  };

  if (isLoading) {
      return <InstitutionTableSkeleton />;
  }
  
  if (!institutions || institutions.length === 0) {
      return (
          <div className="text-center py-16 text-slate-500">
              <h3 className="text-xl font-bold text-slate-700">No hay instituciones</h3>
              <p className="mt-2">Empieza por crear la primera institución educativa.</p>
          </div>
      )
  }

  return (
    <Table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Institución</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</TableHead>
            </TableRow>
        </thead>
        <tbody className="divide-y divide-slate-100">
            {institutions?.map((inst) => (
                <TableRow key={inst.id} className="hover:bg-slate-50/50 transition-all">
                    <TableCell className="px-6 py-5 flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                           <Building className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="font-bold text-slate-800 uppercase italic">{inst.nombre}</span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                       <div className="font-mono text-xs text-blue-500 bg-blue-50 rounded-md p-1 px-2 inline-block">{inst.id}</div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${inst.superAdminSuspended ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {inst.superAdminSuspended ? 'Inactiva' : 'Activo'}
                        </span>
                    </TableCell>
                     <TableCell className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-4">
                            <Switch
                                id={`switch-${inst.id}`}
                                checked={!inst.superAdminSuspended}
                                onCheckedChange={(checked) => handleStatusChange(inst.id, !checked)}
                            />
                             <Button asChild variant="link" className="text-xs font-black text-slate-400 hover:text-blue-600 uppercase tracking-tighter p-0 h-auto">
                                <Link href={`/dashboard?institutionId=${inst.id}`}>
                                    Gestionar
                                </Link>
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
            ))}
        </tbody>
    </Table>
  );
}
