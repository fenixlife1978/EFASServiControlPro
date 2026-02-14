'use client';
import {
  doc,
  writeBatch,
  Firestore,
  collection,
  getDocs,
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
}

export async function confirmEnrollment({
  firestore,
  enrollmentId,
  pendingData,
  studentName,
  institutionId,
}: ConfirmEnrollmentParams): Promise<void> {
  const batch = writeBatch(firestore);

  // Calculate the next device number
  const alumnosRef = collection(firestore, 'institutions', institutionId, 'Aulas', pendingData.classroomId, 'Alumnos');
  const snapshot = await getDocs(alumnosRef).catch(e => {
    // Handle potential permission error on getDocs
     const permissionError = new FirestorePermissionError({
      path: alumnosRef.path,
      operation: 'list',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw e;
  });
  const nextNumber = snapshot.size + 1;
  const nroEquipo = nextNumber.toString().padStart(2, '0');

  // 1. Define the reference to the document in /pending_enrollments
  const pendingDocRef = doc(firestore, 'pending_enrollments', enrollmentId);

  // 2. Define the reference for the new document in the nested devices subcollection
  const newDeviceRef = doc(
    firestore, 
    'institutions', institutionId, 
    'Aulas', pendingData.classroomId, 
    'Alumnos', enrollmentId
  );

  // 3. Create the new device data object
  const newDeviceData: Omit<Alumno, 'id'> = {
    nombre_alumno: studentName,
    classroomId: pendingData.classroomId,
    institutionId: institutionId,
    macAddress: pendingData.deviceInfo.macAddress,
    modelo: pendingData.deviceInfo.model,
    nro_equipo: nroEquipo,
  };

  // 4. Add operations to the batch
  batch.set(newDeviceRef, newDeviceData);
  batch.delete(pendingDocRef);

  // 5. Commit the batch
  return batch.commit().catch(async (serverError) => {
    // If the batch fails, it's likely a permissions issue.
    const permissionError = new FirestorePermissionError({
      path: `batch write (Alumnos collection and pending_enrollments)`,
      operation: 'write',
      requestResourceData: { newDevice: newDeviceData, deletedId: enrollmentId },
    });
    errorEmitter.emit('permission-error', permissionError);
    // Re-throw the original error to be caught by the caller
    throw serverError;
  });
}
