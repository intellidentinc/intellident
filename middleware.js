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

// Build the per-request Content-Security-Policy. Scripts are restricted to a per-request
// nonce + 'strict-dynamic' (no 'unsafe-inline'), so an injected inline <script> cannot run.
// Next.js auto-applies this nonce to its own injected scripts because we forward the CSP on
// the request headers below. style-src keeps 'unsafe-inline' — MUI/Emotion inject styles at
// runtime; tightening that is a separate, browser-verified follow-up.
function buildCsp(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://vitals.vercel-insights.com https://psgc.cloud https://psgc.gitlab.io",
    "frame-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

export async function middleware(request) {
  const userCookie = request.cookies.get('user');
  const { pathname } = request.nextUrl;

  // Per-request CSP nonce. Forward it on the request headers so Next.js picks it up and
  // stamps it onto the scripts it injects during render; mirror it onto every response.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  // Page-rendering responses must carry the forwarded request headers (so the render sees
  // the nonce) plus the CSP response header.
  const nextRes = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };
  // Redirects / JSON don't render HTML but still get the CSP header for uniform coverage.
  const withCsp = (res) => {
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };

  const isAuthPage  = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const isDashboard = /^\/[^/]+\/dashboard/.test(pathname);
  const isSignOut   = pathname === '/api/auth/sign-out';

  // Authenticated user hitting auth page → validate DB session then redirect to dashboard
  if (userCookie && isAuthPage) {
    const session = verifyCookie(userCookie.value);

    // Forged / tampered / unsigned cookie — clear it and let the user land on the auth page
    if (!session) {
      const res = nextRes();
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
          const res = nextRes();
          res.cookies.delete('user');
          return res;
        }
      }
    } catch {
      // DB error: fall through to the redirect below (page-level guards handle it)
    }

    if (session.clinicId) {
      return withCsp(NextResponse.redirect(new URL(`/${session.clinicId}/dashboard`, request.url)));
    }
    if (session.role === ROLES.SUPERADMIN) {
      return withCsp(NextResponse.redirect(new URL('/super', request.url)));
    }
    // Session with no clinic and not superadmin — broken state; clear it and stay on the auth page
    const res = nextRes();
    res.cookies.delete('user');
    return res;
  }

  // Unauthenticated user hitting dashboard → redirect to sign-in
  if (!userCookie && isDashboard) {
    return withCsp(NextResponse.redirect(new URL('/sign-in', request.url)));
  }

  if (userCookie && !isSignOut) {
    const session = verifyCookie(userCookie.value);

    // Forged / tampered / unsigned cookie — strip it and continue unauthenticated.
    if (!session) {
      const res = nextRes();
      res.cookies.delete('user');
      return res;
    }

    // Hard 8-hour cap — force re-login regardless of sliding renewal
    if (!session.sessionCreatedAt || Date.now() - session.sessionCreatedAt > SESSION_HARD_LIMIT_MS) {
      if (pathname.startsWith('/api/')) {
        const res = withCsp(NextResponse.json({ error: 'Session expired' }, { status: 401 }))
        res.cookies.delete('user')
        return res
      }
      const res = withCsp(NextResponse.redirect(new URL('/sign-in', request.url)))
      res.cookies.delete('user')
      return res
    }

    // Terms of service gate — sessions created before acceptance are confined to /accept-terms
    if (session.requiresTerms) {
      const isAcceptTermsPage = pathname === '/accept-terms'
      const isAcceptTermsApi  = pathname === '/api/auth/accept-terms'
      if (!isAcceptTermsPage && !isAcceptTermsApi) {
        if (pathname.startsWith('/api/')) {
          return withCsp(NextResponse.json({ error: 'Please accept the Terms of Service to continue.' }, { status: 403 }))
        }
        return withCsp(NextResponse.redirect(new URL('/accept-terms', request.url)))
      }
    }

    // Forced password-change gate — admin-created staff carry mustChangePassword and must
    // be confined to the change-password flow on every route, not just the client-side
    // redirect at login. Runs after the Terms gate so terms are accepted first.
    // /api/auth/sign-out is already excluded (isSignOut, above).
    if (session.mustChangePassword && !session.requiresTerms) {
      const isChangePwPage = pathname === '/change-password'
      const isChangePwApi  = pathname === '/api/auth/change-password'
      if (!isChangePwPage && !isChangePwApi) {
        if (pathname.startsWith('/api/')) {
          return withCsp(NextResponse.json({ error: 'You must change your password before continuing.' }, { status: 403 }))
        }
        return withCsp(NextResponse.redirect(new URL('/change-password?reason=first-login', request.url)))
      }
    }

    // Block requests for sessions tied to a disabled clinic
    if (session.clinicId && !session.superAdmin && !isPublicApi(pathname)) {
      try {
        const isEnabled = await getClinicEnabled(session.clinicId);
        if (isEnabled === false) {
          if (pathname.startsWith('/api/')) {
            return withCsp(NextResponse.json({ error: 'Clinic is disabled' }, { status: 403 }));
          }
          return withCsp(NextResponse.redirect(new URL('/sign-in', request.url)));
        }
      } catch {
        // DB error: fail open (let page-level guards handle it)
      }
    }

    // Auth route handlers (sign-in, verify-otp, accept-terms, change-password, step-up, …)
    // own the session-cookie lifecycle. Re-issuing the incoming (stale) cookie here would
    // clobber the fresh Set-Cookie they emit on the same response — e.g. accept-terms
    // clearing requiresTerms — so skip TTL renewal for them.
    if (pathname.startsWith('/api/auth/')) {
      return nextRes();
    }

    // Notification polls are read-only and fire every 30s. Excluding them from cookie
    // re-issue prevents a race where a stale poll response (sent before step-up was
    // granted) overwrites the updated session cookie (with stepUpGrantedAt) that the
    // step-up POST just wrote, silently killing the step-up grant.
    if (pathname.startsWith('/api/notifications')) {
      return nextRes();
    }

    // Sliding window: refresh cookie TTL on every authenticated non-signout request
    const maxAge  = session.rememberMe ? REMEMBER_ME_MAX_AGE : DEFAULT_MAX_AGE;
    const response = nextRes();
    response.cookies.set('user', userCookie.value, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
    });
    return response;
  }

  return nextRes();
}

export const config = {
  matcher: [
    // Clinic-scoped pages (exclude known non-clinic top-level segments)
    '/((?!api|super|sign-in|sign-up|forgot-password|reset-password|change-password|verify-otp|_next|favicon)[^/]+)/:path*',
    // Standalone routes — listed explicitly so the per-request CSP (and auth gates) apply.
    '/',
    '/super/:path*',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
    '/change-password',
    '/verify-otp',
    '/accept-terms',
    '/api/:path*',
  ],
};
