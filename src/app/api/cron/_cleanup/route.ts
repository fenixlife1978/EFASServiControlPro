import { NextResponse } from 'next/server';

/**
 * Este es el "Portero" de la ruta de limpieza (Cleanup).
 * Al NO tener 'export const dynamic', Next.js permite el build estático de Android.
 */
export async function GET(req: Request) {
  // 1. Bloqueo inmediato para el build de Android/Capacitor
  // Evita que el compilador intente procesar dependencias de servidor (Firebase Admin)
  if (process.env.IS_ANDROID_BUILD === 'true') {
    return new Response(null, { status: 404 });
  }

  // 2. IMPORTACIÓN DINÁMICA: 
  // Solo cargamos la lógica pesada cuando la ruta es llamada en Vercel.
  try {
    // Usamos @ts-ignore para que TypeScript no se queje si no encuentra el módulo
    // durante el análisis estático en el entorno de desarrollo/build móvil.
    // @ts-ignore
    const { handleCleanup } = await import('./action');
    
    // Ejecutamos la función exportada en action.ts
    return handleCleanup(req);
  } catch (error: any) {
    console.error("Error cargando la acción de limpieza:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al cargar el módulo de limpieza" }, 
      { status: 500 }
    );
  }
}
