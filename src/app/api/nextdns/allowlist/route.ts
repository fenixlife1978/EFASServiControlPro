// src/app/api/nextdns/allowlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { addToAllowlist, removeFromAllowlist, getAllowlist } from '@/lib/nextdns';

export async function GET() {
  try {
    const allowlist = await getAllowlist();
    if (allowlist === null) {
      return NextResponse.json(
        { error: 'Error al obtener la lista blanca' },
        { status: 500 }
      );
    }
    return NextResponse.json({ domains: allowlist });
  } catch (error) {
    console.error('Error en GET /api/nextdns/allowlist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;
    
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere un dominio válido' },
        { status: 400 }
      );
    }
    
    const success = await addToAllowlist(domain);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Error al añadir dominio a la lista blanca' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, domain });
  } catch (error) {
    console.error('Error en POST /api/nextdns/allowlist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Se requiere un dominio (query param: ?domain=ejemplo.com)' },
        { status: 400 }
      );
    }
    
    const success = await removeFromAllowlist(domain);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Error al eliminar dominio de la lista blanca' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, domain });
  } catch (error) {
    console.error('Error en DELETE /api/nextdns/allowlist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}