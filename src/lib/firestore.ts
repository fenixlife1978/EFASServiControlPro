'use client';
import {
  doc,
  writeBatch,
  Firestore,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Alumno, PendingEnrollment } from './firestore-types';

interface ConfirmEnrollmentParams {
  firestore: Firestore;
  enrollmentId: string;
  pendingData: PendingEnrollment;
  studentName: string;
  institutionId: string;
  aulaId: string;
  seccion: string;
}

export async function confirmEnrollment({
  firestore,
  enrollmentId,
  pendingData,
  studentName,
  institutionId,
  aulaId,
  seccion,
}: ConfirmEnrollmentParams): Promise<void> {
  const batch = writeBatch(firestore);

  // 🔥 CORREGIDO: Calcular número de equipo basado en dispositivos existentes
  const dispositivosRef = collection(firestore, 'dispositivos');
  const dispositivosQuery = query(dispositivosRef, where("InstitutoId", "==", institutionId));
  const snapshot = await getDocs(dispositivosQuery).catch(e => {
    const permissionError = new FirestorePermissionError({
      path: dispositivosRef.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw e;
  });
  
  const nextNumber = snapshot.size + 1;
  const nroEquipo = nextNumber.toString().padStart(3, '0');
  
  // Generar ID único para el usuario basado en el nombre
  const baseName = studentName.toLowerCase().trim().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const suffix = enrollmentId.slice(-4);
  const customId = `${baseName}_${suffix}`;

  // 🔥 CORREGIDO: Guardar en colección "usuarios" (no en subcolección Alumnos)
  const userRef = doc(firestore, 'usuarios', customId);
  
  // Datos del nuevo alumno
  const newUserData = {
    id: customId,
    nombre: studentName.trim(),
    rol: 'alumno',
    InstitutoId: institutionId,
    aulaId: aulaId,
    seccion: seccion,
    deviceId: enrollmentId, // El ID del dispositivo pendiente
    nro_equipo: nroEquipo,
    macAddress: pendingData.deviceInfo?.macAddress || '',
    modelo: pendingData.deviceInfo?.model || '',
    status: 'active',
    createdAt: serverTimestamp()
  };

  // 🔥 CORREGIDO: Actualizar el dispositivo existente
  const deviceRef = doc(firestore, 'dispositivos', enrollmentId);
  
  // Operaciones en el batch
  batch.set(userRef, newUserData);
  batch.update(deviceRef, {
    alumno_asignado: studentName.trim(),
    status: 'active',
    vinculado: true,
    lastUpdated: serverTimestamp()
  });

  // Si existe pending_enrollments, eliminarlo
  if (enrollmentId) {
    const pendingDocRef = doc(firestore, 'pending_enrollments', enrollmentId);
    batch.delete(pendingDocRef);
  }

  return batch.commit().catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: `batch write (usuarios and dispositivos)`,
      operation: 'write',
      requestResourceData: { newUser: newUserData, deviceId: enrollmentId },
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  });
}
