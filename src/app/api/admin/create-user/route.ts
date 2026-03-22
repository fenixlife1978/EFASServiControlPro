import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: "Servidor: Firebase Admin no ha sido inicializado. Verifica tus credenciales." }, { status: 500 });
    }

    const body = await req.json();
    const { email, password, nombre, rol, institutionId } = body;

    if (!email || !password || !nombre || !rol || !institutionId) {
      return NextResponse.json({ error: "Faltan parámetros de registro (email, password, nombre, rol, sede)" }, { status: 400 });
    }

    // 1. Crear el usuario en Firebase Authentication SIN DESLOGUEAR al SuperAdmin/Director
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
    });

    // 2. Configurar "Custom Claims" para proteger las reglas de Firestore nativamente
    await adminAuth.setCustomUserClaims(userRecord.uid, {
        institutionId: institutionId,
        rol: rol
    });

    // 3. Crear automáticamente el documento del perfil en Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      nombre: nombre,
      email: email,
      rol: rol,
      InstitutoId: institutionId,
      fechaRegistro: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      message: `El perfil de ${rol} y su acceso han sido creados correctamente en la base de datos.`
    });

  } catch (error: any) {
    console.error("API Error creando usuario:", error);
    return NextResponse.json({ error: error.message || "Error interno creando el usuario" }, { status: 500 });
  }
}
