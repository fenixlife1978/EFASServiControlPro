import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Obtenemos la cookie de sesión (ajusta el nombre si usas uno diferente)
  const session = request.cookies.get('__session')?.value || request.cookies.get('next-auth.session-token')?.value;
  
  const { pathname } = request.nextUrl;

  // 2. Definimos las rutas que requieren protección
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAdminRoute = pathname.startsWith('/(admin)');
  const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname === '/';

  // 3. REGLA DE ORO: Si intenta entrar a dashboard sin sesión -> Al Login
  if ((isDashboardRoute || isAdminRoute) && !session) {
    const loginUrl = new URL('/login', request.url);
    // Guardamos la ruta a la que quería ir para devolverlo ahí después del login
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Si ya tiene sesión e intenta ir al login o raíz -> Al Dashboard
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// 5. Configuración del Matcher: Qué rutas vigila el Middleware
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/(admin)/:path*',
    '/login',
    '/signup',
  ],
};
