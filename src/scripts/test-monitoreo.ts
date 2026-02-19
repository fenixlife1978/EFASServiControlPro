import { db } from '@/firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const simularNavegacion = async (institutoId: string) => {
  const mockSessions = [
    { id: 'TAB-01', user: 'Juan Perez (Alumno)', url: 'https://wikipedia.org/ciencias' },
    { id: 'TAB-02', user: 'Maria Garcia (Profesor)', url: 'https://classroom.google.com' },
    { id: 'TAB-03', user: 'Lucas Gomez (Alumno)', url: 'https://efas-control.edu/examen' }
  ];

  try {
    for (const session of mockSessions) {
      await setDoc(doc(db, 'sesiones_monitoreo', session.id), {
        InstitutoId: institutoId,
        tabletId: session.id,
        usuario: session.user,
        url_actual: session.url,
        ultima_actividad: serverTimestamp()
      });
    }
    console.log('✅ Simulación de radar activada con éxito');
  } catch (error) {
    console.error('❌ Error en simulación:', error);
  }
};
