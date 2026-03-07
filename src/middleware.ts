import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;
  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/', '/api'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Si no hay sesión y trata de entrar a áreas privadas
  if (!session && !isPublicPath) {
    console.log('🚫 Redirigiendo a login - Sin sesión');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 🔥 CORREGIDO: Si hay sesión e intenta ir a login o raíz
  if (session && (pathname === '/login' || pathname === '/')) {
    console.log('✅ Redirigiendo a dashboard - Sesión activa');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
