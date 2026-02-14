'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Alumno } from '@/lib/firestore-types';
import { format } from 'date-fns';
import { Globe, Clock } from 'lucide-react';

interface InfractionLogModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  student: Alumno | null;
}

const getTodayLogs = (student: Alumno | null) => {
    if (!student || !student.logs_actividad) return [];
    const today = new Date();
    return student.logs_actividad
        .filter(log => {
            if (!log.date) return false;
            const logDate = log.date.toDate();
            return logDate.getDate() === today.getDate() &&
                   logDate.getMonth() === today.getMonth() &&
                   logDate.getFullYear() === today.getFullYear();
        })
        .sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

export function InfractionLogModal({ isOpen, onOpenChange, student }: InfractionLogModalProps) {
  const logs = getTodayLogs(student);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registro de Infracciones de Hoy</DialogTitle>
          <DialogDescription>
            Mostrando intentos de acceso a sitios bloqueados para {student?.nombre_alumno}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-4">
            {logs.length > 0 ? (
                logs.map((log, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 rounded-lg border bg-secondary/50 p-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <p className="truncate font-mono text-sm text-foreground" title={log.url}>
                                {log.url}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            <span>{format(log.date.toDate(), 'HH:mm:ss')}</span>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No se registraron infracciones hoy.</p>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
