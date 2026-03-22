import { NextResponse } from 'next/server';
import { adminRtdb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    if (!adminRtdb) {
      return NextResponse.json({ error: "Firebase DB (Admin) no inicializada" }, { status: 500 });
    }

    // Calcular el timestamp exacto de hace 7 días (168 horas)
    const sieteDiasAtras = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    // 1. Limpieza de 'historial_navegacion' (URLs Visitadas a diario)
    const historialRef = adminRtdb.ref('historial_navegacion');
    const dispositivosSnapshot = await historialRef.once('value');

    if (dispositivosSnapshot.exists()) {
      const dispositivos = dispositivosSnapshot.val();
      for (const [deviceId, logs] of Object.entries(dispositivos)) {
        for (const [logId, logData] of Object.entries(logs as any)) {
          const timestamp = (logData as any).timestamp || Number(logId);
          if (timestamp && timestamp < sieteDiasAtras) {
            await historialRef.child(deviceId).child(logId).remove();
            deletedCount++;
          }
        }
      }
    }

    // 2. Limpieza de 'system_logs' en 'dispositivos' (Registros de inicio y liberaciones de Android)
    const dispRef = adminRtdb.ref('dispositivos');
    const dSnap = await dispRef.once('value');
    
    if (dSnap.exists()) {
      const dObj = dSnap.val();
      for (const [dId, data] of Object.entries(dObj as any)) {
        if (data && data.system_logs) {
          for(const [tsStr, log] of Object.entries(data.system_logs as any)) {
            const timestamp = Number(tsStr);
            if (timestamp && timestamp < sieteDiasAtras) {
              await dispRef.child(dId).child('system_logs').child(tsStr).remove();
              deletedCount++;
            }
          }
        }
      }
    }

    return NextResponse.json({ 
        success: true, 
        deleted: deletedCount, 
        message: `Mantenimiento exitoso. Se han purgado permanentemente ${deletedCount} registros anteriores a 7 días en la RTDB para ahorrar cuota y optimizar lecturas.` 
    });

  } catch (error: any) {
    console.error("Error en Limpieza Automática RTDB:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
