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
import { ref, update, set } from 'firebase/database';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Alumno, PendingEnrollment } from './firestore-types';

interface ConfirmEnrollmentParams {
  firestore: Firestore;
  rtdb: any; // Realtime Database instance
  enrollmentId: string;
  pendingData: PendingEnrollment;
  studentName: string;
  institutionId: string;
  aulaId: string;
  seccion: string;
}

export async function confirmEnrollment({
  firestore,
  rtdb,
  enrollmentId,
  pendingData,
  studentName,
  institutionId,
  aulaId,
  seccion,
}: ConfirmEnrollmentParams): Promise<void> {
  const batch = writeBatch(firestore);

  // Calcular número de equipo basado en dispositivos existentes
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

  // 1. FIRESTORE: Guardar en colección "usuarios"
  const userRef = doc(firestore, 'usuarios', customId);
  
  const newUserData = {
    id: customId,
    nombre: studentName.trim(),
    rol: 'alumno',
    InstitutoId: institutionId,
    aulaId: aulaId,
    seccion: seccion,
    deviceId: enrollmentId,
    nro_equipo: nroEquipo,
    macAddress: pendingData.deviceInfo?.macAddress || '',
    modelo: pendingData.deviceInfo?.model || '',
    status: 'active',
    createdAt: serverTimestamp()
  };

  // 2. FIRESTORE: Actualizar el dispositivo existente
  const deviceRef = doc(firestore, 'dispositivos', enrollmentId);
  
  batch.set(userRef, newUserData);
  batch.update(deviceRef, {
    alumno_asignado: studentName.trim(),
    status: 'active',
    vinculado: true,
    lastUpdated: serverTimestamp()
  });

  // 3. RTDB: Actualizar dispositivo en tiempo real (ruta dispositivos/)
  const rtdbDeviceRef = ref(rtdb, `dispositivos/${enrollmentId}`);
  await update(rtdbDeviceRef, {
    alumno_asignado: studentName.trim(),
    status: 'active',
    vinculado: true,
    lastUpdated: Date.now(),
    aulaId: aulaId,
    seccion: seccion,
    InstitutoId: institutionId
  });

  // 4. RTDB: Actualizar status_dispositivos/ para monitoreo en tiempo real
  const rtdbStatusRef = ref(rtdb, `status_dispositivos/${enrollmentId}`);
  await update(rtdbStatusRef, {
    alumno_asignado: studentName.trim(),
    estado: 'active',
    lastUpdated: Date.now(),
    lastSeen: Date.now(),
    aulaId: aulaId,
    seccion: seccion,
    InstitutoId: institutionId
  });

  // 5. Si existe pending_enrollments, eliminarlo
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
