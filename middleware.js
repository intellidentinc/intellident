import { NextResponse } from 'next/server';

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 3; // 3 days
const DEFAULT_MAX_AGE     = 60 * 10;           // 10 minutes

export function middleware(request) {
  const userCookie = request.cookies.get('user');
  const { pathname } = request.nextUrl;

  const isAuthPage  = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const isDashboard = /^\/[^/]+\/dashboard/.test(pathname);
  const isSignOut   = pathname === '/api/auth/sign-out';

  // Authenticated user hitting auth page → redirect to dashboard
  if (userCookie && isAuthPage) {
    try {
      const session = JSON.parse(userCookie.value);
      const dest = session.clinicId ? `/${session.clinicId}/dashboard` : '/sign-in';
      return NextResponse.redirect(new URL(dest, request.url));
    } catch {
      return NextResponse.next();
    }
  }

  // Unauthenticated user hitting dashboard → redirect to sign-in
  if (!userCookie && isDashboard) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // Sliding window: refresh cookie TTL on every authenticated non-signout request
  if (userCookie && !isSignOut) {
    try {
      const session = JSON.parse(userCookie.value);
      const maxAge  = session.rememberMe ? REMEMBER_ME_MAX_AGE : DEFAULT_MAX_AGE;
      const response = NextResponse.next();
      response.cookies.set('user', userCookie.value, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
      });
      return response;
    } catch {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/:clinicId/dashboard/:path*',
    '/sign-in',
    '/sign-up',
    '/api/:path*',
  ],
};
