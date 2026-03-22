import { NextResponse } from 'next/server';

export function middleware(request) {
  const userCookie = request.cookies.get('user');
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const isDashboard = pathname.startsWith('/dashboard');

  if (userCookie && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!userCookie && isDashboard) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/sign-in', '/sign-up']
};
