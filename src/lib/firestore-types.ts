import { Timestamp } from 'firebase/firestore';

export interface Institution {
  id: string;
  nombre: string;
  direccion?: string;
  logoUrl?: string;
  modoFiltro: 'Blacklist' | 'Whitelist';
  superAdminSuspended: boolean;
  createdAt: Timestamp;
}

export interface Classroom {
  id: string;
  institutionId: string;
  grado: string;
  seccion: string;
  nombre_completo: string;
  capacidad?: number;
  status: 'published' | 'draft';
  createdAt?: Timestamp;
}

export interface Alumno {
  id: string;
  institutionId: string;
  classroomId: string;
  nombre_alumno: string;
  nro_equipo: string;
  modelo: string;
  macAddress: string;
  logs_actividad?: {
    url: string;
    date: Timestamp;
    duration: number;
  }[];
}

export interface PendingEnrollment {
  id?: string;
  classroomId: string;
  deviceInfo: {
    macAddress: string;
    model: string;
  };
  timestamp: Timestamp; // Should be a server timestamp
}
