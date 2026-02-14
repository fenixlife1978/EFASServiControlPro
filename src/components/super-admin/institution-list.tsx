'use client';

import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Institution } from '@/lib/firestore-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Switch } from '../ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Globe, Lock, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';

const InstitutionTableSkeleton = () => (
    <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
);

export function InstitutionList() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

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

  const gestionarInstitucion = (institutoId: string) => {
    if (!institutoId) {
      toast({
        title: 'Error',
        description: 'Esta institución no tiene un ID de acceso (InstitutoId) asignado.',
        variant: 'destructive',
      });
      return;
    }
    router.push(`/dashboard?institutionId=${institutoId}`);
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
          <TableHead className="font-bold text-slate-900">InstitutoId</TableHead>
          <TableHead className="font-bold text-slate-900">Estado</TableHead>
          <TableHead className="text-right font-bold text-slate-900">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {institutions.map((inst) => (
          <TableRow key={inst.id}>
            <TableCell className="font-medium text-slate-900">{inst.nombre}</TableCell>
            <TableCell>
              <code className="bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">
                {inst.InstitutoId || 'SIN ID'}
              </code>
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
            <TableCell className="text-right flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => gestionarInstitucion(inst.InstitutoId)}
                className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                disabled={!inst.InstitutoId}
              >
                <ExternalLink className="w-4 h-4 mr-1" /> GESTIONAR
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(inst.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
