export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { verifyCookie } from '@/lib/session-cookie';
import { ROLES } from '@/lib/roles';

const getClinicEnabled = unstable_cache(
  async (clinicId) => {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { isEnabled: true },
    });
    return clinic?.isEnabled ?? null;
  },
  ['clinic-enabled'],
  { revalidate: 60, tags: ['clinic-enabled'] }
);

const REMEMBER_ME_MAX_AGE    = 60 * 60 * 24 * 3;       // 3 days
const DEFAULT_MAX_AGE        = 60 * 10;                // 10 minutes
const SESSION_HARD_LIMIT_MS  = 8 * 60 * 60 * 1000;    // 8-hour absolute cap

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

  // Authenticated user hitting auth page → validate DB session then redirect to dashboard
  if (userCookie && isAuthPage) {
    const session = verifyCookie(userCookie.value);

    // Forged / tampered / unsigned cookie — clear it and let the user land on the auth page
    if (!session) {
      const res = NextResponse.next();
      res.cookies.delete('user');
      return res;
    }

    try {
      if (session.sessionToken) {
        const dbSession = await prisma.userSession.findUnique({
          where: { sessionToken: session.sessionToken },
          select: { terminatedAt: true },
        });
        if (!dbSession || dbSession.terminatedAt) {
          // Stale cookie — clear it and let the user land on the auth page
          const res = NextResponse.next();
          res.cookies.delete('user');
          return res;
        }
      }
    } catch {
      // DB error: fall through to the redirect below (page-level guards handle it)
    }

    if (session.clinicId) {
      return NextResponse.redirect(new URL(`/${session.clinicId}/dashboard`, request.url));
    }
    if (session.role === ROLES.SUPERADMIN) {
      return NextResponse.redirect(new URL('/super', request.url));
    }
    // Session with no clinic and not superadmin — broken state; clear it and stay on the auth page
    const res = NextResponse.next();
    res.cookies.delete('user');
    return res;
  }

  // Unauthenticated user hitting dashboard → redirect to sign-in
  if (!userCookie && isDashboard) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  if (userCookie && !isSignOut) {
    const session = verifyCookie(userCookie.value);

    // Forged / tampered / unsigned cookie — strip it and continue unauthenticated.
    if (!session) {
      const res = NextResponse.next();
      res.cookies.delete('user');
      return res;
    }

    // Hard 8-hour cap — force re-login regardless of sliding renewal
    if (!session.sessionCreatedAt || Date.now() - session.sessionCreatedAt > SESSION_HARD_LIMIT_MS) {
      if (pathname.startsWith('/api/')) {
        const res = NextResponse.json({ error: 'Session expired' }, { status: 401 })
        res.cookies.delete('user')
        return res
      }
      const res = NextResponse.redirect(new URL('/sign-in', request.url))
      res.cookies.delete('user')
      return res
    }

    // Terms of service gate — sessions created before acceptance are confined to /accept-terms
    if (session.requiresTerms) {
      const isAcceptTermsPage = pathname === '/accept-terms'
      const isAcceptTermsApi  = pathname === '/api/auth/accept-terms'
      if (!isAcceptTermsPage && !isAcceptTermsApi) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Please accept the Terms of Service to continue.' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/accept-terms', request.url))
      }
    }

    // Block requests for sessions tied to a disabled clinic
    if (session.clinicId && !session.superAdmin && !isPublicApi(pathname)) {
      try {
        const isEnabled = await getClinicEnabled(session.clinicId);
        if (isEnabled === false) {
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
    '/accept-terms',
    '/api/:path*',
  ],
};
