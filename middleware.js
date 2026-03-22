import { NextResponse } from 'next/server';

export function middleware(request) {
  const userCookie = request.cookies.get('user');
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const isDashboard = /^\/[^/]+\/dashboard/.test(pathname);

  if (userCookie && isAuthPage) {
    try {
      const session = JSON.parse(userCookie.value);
      const dest = session.clinicId ? `/${session.clinicId}/dashboard` : '/sign-in';
      return NextResponse.redirect(new URL(dest, request.url));
    } catch {
      return NextResponse.next();
    }
  }

  if (!userCookie && isDashboard) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:clinicId/dashboard/:path*', '/sign-in', '/sign-up'],
};
