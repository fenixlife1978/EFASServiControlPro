export const dynamic = "force-static";
import { NextResponse } from 'next/server';

/**
 * Endpoint de Aprovisionamiento EDUControlPro
 * Actualmente operando en Static Mode para máxima velocidad de respuesta.
 * Este endpoint servirá de base para el despliegue de configuraciones iniciales.
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'success', 
    message: 'EDUControlPro Provisioning Endpoint: READY (Static Mode)',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}
