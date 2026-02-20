import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;
  const { pathname } = request.nextUrl;

  // Si no hay sesión y trata de entrar a áreas privadas
  if (!session && (pathname.startsWith('/dashboard') || pathname.startsWith('/super-admin'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si ya hay sesión e intenta ir al login o raíz
  if (session && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
