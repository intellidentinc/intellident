export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { verifyCookie } from '@/lib/session-cookie';

import { resolveSession } from '@/lib/session-state';

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

  const isAuthPage = pathname === '/sign-in' || pathname === '/sign-up';
  if (!userCookie || pathname === '/api/auth/sign-out') return nextRes();
  let session;
  try {
    session = await resolveSession(verifyCookie(userCookie.value), !pathname.startsWith('/api/notifications'));
  } catch {
    return withCsp(NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 }));
  }
  if (!session) {
    const response = nextRes();
    response.cookies.delete('user');
    return response;
  }
  if (isAuthPage) {
    return withCsp(NextResponse.redirect(new URL(session.clinicId ? '/' + session.clinicId + '/dashboard' : '/super', request.url)));
  }
  if (session.requiresTerms && !['/accept-terms', '/api/auth/accept-terms'].includes(pathname)) {
    return withCsp(pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Please accept the Terms of Service to continue.' }, { status: 403 })
      : NextResponse.redirect(new URL('/accept-terms', request.url)));
  }
  if (session.mustChangePassword && !session.requiresTerms && !['/change-password', '/api/auth/change-password'].includes(pathname)) {
    return withCsp(pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'You must change your password before continuing.' }, { status: 403 })
      : NextResponse.redirect(new URL('/change-password?reason=' + (session.passwordExpired ? 'expired' : 'first-login'), request.url)));
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
