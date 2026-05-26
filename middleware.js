export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 3; // 3 days
const DEFAULT_MAX_AGE     = 60 * 10;           // 10 minutes

// Public API paths that never require a clinic check
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/clinics',
  '/api/super',
  '/api/webhooks',
  '/api/cron',
];

function isPublicApi(pathname) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request) {
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

  if (userCookie && !isSignOut) {
    let session;
    try {
      session = JSON.parse(userCookie.value);
    } catch {
      return NextResponse.next();
    }

    // Block requests for sessions tied to a disabled clinic
    if (session.clinicId && !session.superAdmin && !isPublicApi(pathname)) {
      try {
        const clinic = await prisma.clinic.findUnique({
          where: { id: session.clinicId },
          select: { isEnabled: true },
        });
        if (clinic && !clinic.isEnabled) {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Clinic is disabled' }, { status: 403 });
          }
          return NextResponse.redirect(new URL('/sign-in', request.url));
        }
      } catch {
        // DB error: fail open (let page-level guards handle it)
      }
    }

    // Sliding window: refresh cookie TTL on every authenticated non-signout request
    const maxAge  = session.rememberMe ? REMEMBER_ME_MAX_AGE : DEFAULT_MAX_AGE;
    const response = NextResponse.next();
    response.cookies.set('user', userCookie.value, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Clinic-scoped pages (exclude known non-clinic top-level segments)
    '/((?!api|super|sign-in|sign-up|forgot-password|reset-password|change-password|verify-otp|_next|favicon)[^/]+)/:path*',
    '/sign-in',
    '/sign-up',
    '/api/:path*',
  ],
};
