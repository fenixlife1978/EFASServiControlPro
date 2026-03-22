// Movemos las configuraciones aquí. Next.js no las validará como "estáticas" 
// porque este archivo ya no se llama route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
// Usamos ruta relativa para evitar fallos de alias en el build
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export async function handleCreateUser(req: Request) {
  try {
    // Validamos la inicialización de los servicios de administración
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ 
        error: "Servidor: Firebase Admin no ha sido inicializado. Verifica las variables de entorno." 
      }, { status: 500 });
    }

    const body = await req.json();
    const { email, password, nombre, rol, institutionId } = body;

    if (!email || !password || !nombre || !rol || !institutionId) {
      return NextResponse.json({ 
        error: "Faltan parámetros de registro (email, password, nombre, rol, sede)" 
      }, { status: 400 });
    }

    // 1. Crear el usuario en Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
    });

    // 2. Configurar "Custom Claims" (Claims de seguridad)
    await adminAuth.setCustomUserClaims(userRecord.uid, {
        institutionId: institutionId,
        rol: rol
    });

    // 3. Crear el documento de perfil en Firestore
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
      message: `El perfil de ${rol} y su acceso han sido creados correctamente.`
    });

  } catch (error: any) {
    console.error("API Error creando usuario:", error);
    
    const message = error.code === 'auth/email-already-exists' 
      ? "Este correo electrónico ya está registrado por otro usuario." 
      : (error.message || "Error interno creando el usuario");
      
    return NextResponse.json({ error: message }, { status: 500 });
  }
}