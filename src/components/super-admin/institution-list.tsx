'use client';

import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import type { Institution } from '@/lib/firestore-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Switch } from '../ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Globe, Lock, Trash2, Loader2, Building } from 'lucide-react';
import { Button } from '../ui/button';

const InstitutionTableSkeleton = () => (
    <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>
);

export function InstitutionList() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const institutionsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'institutions'), orderBy("nombre", "asc"));
  }, [firestore]);

  const { data: institutions, isLoading } = useCollection<Institution>(institutionsRef);
  
  const handleStatusChange = (institutionId: string, currentStatus: string) => {
    if (!firestore) return;
    const newStatus = currentStatus === 'published' ? 'unpublished' : 'published';
    const institutionRef = doc(firestore, 'institutions', institutionId);
    updateDocumentNonBlocking(institutionRef, { status: newStatus });
    toast({ title: 'Estado actualizado', description: `La institución ahora está ${newStatus === 'published' ? 'publicada' : 'oculta'}.` });
  };

  const handleDelete = (institutionId: string) => {
    if (!firestore) return;
    if (confirm("¿Eliminar esta institución? Se perderá el acceso para sus usuarios y se borrarán sus datos.")) {
        const institutionRef = doc(firestore, 'institutions', institutionId);
        deleteDocumentNonBlocking(institutionRef);
        toast({ title: 'Institución eliminada', variant: 'destructive' });
    }
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
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-100 hover:bg-slate-100">
          <TableHead className="font-bold text-slate-900">Institución</TableHead>
          <TableHead className="font-bold text-slate-900">condoId (ID de acceso)</TableHead>
          <TableHead className="font-bold text-slate-900">Estado de Publicación</TableHead>
          <TableHead className="text-right font-bold text-slate-900">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {institutions.map((inst) => (
          <TableRow key={inst.id}>
            <TableCell className="font-medium">{inst.nombre}</TableCell>
            <TableCell>
              <Link href={`/dashboard?institutionId=${inst.condoId}`}>
                <code className="bg-slate-100 px-2 py-1 rounded text-orange-600 font-bold hover:bg-orange-100 transition-colors cursor-pointer">
                  {inst.condoId}
                </code>
              </Link>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Switch 
                  checked={inst.status === 'published'} 
                  onCheckedChange={() => handleStatusChange(inst.id, inst.status)} 
                />
                {inst.status === 'published' ? (
                  <span className="flex items-center text-green-600 text-xs font-bold">
                    <Globe className="w-3 h-3 mr-1" /> PUBLICADO
                  </span>
                ) : (
                  <span className="flex items-center text-red-500 text-xs font-bold">
                    <Lock className="w-3 h-3 mr-1" /> OCULTO
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => handleDelete(inst.id)} className="hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
