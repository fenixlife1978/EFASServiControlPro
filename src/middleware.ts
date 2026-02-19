import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;
  const { pathname } = request.nextUrl;

  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname === '/';

  // REGLA DE PROTECCIÓN
  if (isDashboardRoute && !session) {
    // Si no hay sesión, verificamos si es una redirección interna de login reciente
    // Esto evita el rebote en el primer intento tras limpiar caché
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // REGLA DE REDIRECCIÓN SI YA ESTÁ LOGUEADO
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/signup',
  ],
};
