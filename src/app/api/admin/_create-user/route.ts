import { NextResponse } from 'next/server';

/**
 * Portero de la API de creación de usuarios.
 * Evita que el compilador de Next.js analice Firebase Admin durante el export de Android.
 */
export async function POST(req: Request) {
  // 1. Bloqueo inmediato para el build de Android/Capacitor
  if (process.env.IS_ANDROID_BUILD === 'true') {
    return new Response(null, { status: 404 });
  }

  try {
    // 2. IMPORTANTE: Usamos @ts-ignore para que TypeScript no se detenga si no detecta
    // el archivo 'action' durante el análisis estático inicial.
    // @ts-ignore
    const { handleCreateUser } = await import('./action');
    
    // Ejecutamos la lógica que reside en el cerebro (action.ts)
    return handleCreateUser(req);
  } catch (error: any) {
    console.error("Error cargando el módulo de administración:", error);
    return NextResponse.json(
      { error: "El servicio de administración no está disponible en este momento." }, 
      { status: 500 }
    );
  }
}
