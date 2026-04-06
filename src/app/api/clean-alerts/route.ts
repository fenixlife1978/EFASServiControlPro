// src/app/api/clean-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

function getRtdb() {
  if (!admin.apps.length) {
    try {
      const dbUrl = process.env.FIREBASE_DATABASE_URL || 
                    'https://studio-7637044995-2342d-default-rtdb.firebaseio.com/';
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: dbUrl
      });
      
      console.log('✅ Firebase Admin inicializado');
    } catch (error) {
      console.error('❌ Error inicializando Firebase:', error);
      return null;
    }
  }
  
  return admin.database();
}

export async function POST(request: NextRequest) {
  try {
    const rtdb = getRtdb();
    if (!rtdb) {
      return NextResponse.json({ error: 'RTDB no disponible' }, { status: 500 });
    }
    
    // Mantener solo eventos de las últimas 72 horas
    const seventyTwoHoursAgo = Date.now() - (72 * 60 * 60 * 1000);
    
    console.log(`🧹 Limpiando alertas anteriores a: ${new Date(seventyTwoHoursAgo).toISOString()}`);
    
    const alertsRef = rtdb.ref('alertas_seguridad');
    const snapshot = await alertsRef.orderByChild('timestamp').endAt(seventyTwoHoursAgo).once('value');
    
    const updates: Record<string, null> = {};
    let count = 0;
    
    snapshot.forEach((child) => {
      updates[child.key] = null;
      count++;
    });
    
    if (count > 0) {
      await alertsRef.update(updates);
      console.log(`✅ Eliminadas ${count} alertas antiguas (más de 72 horas)`);
    } else {
      console.log('📭 No hay alertas antiguas para eliminar');
    }
    
    return NextResponse.json({
      success: true,
      deleted: count,
      message: `${count} alertas eliminadas (más de 72 horas)`
    });
    
  } catch (error) {
    console.error('Error en limpieza de alertas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}