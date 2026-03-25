/**
 * InactivityProvider — Auto Logout After 30 Minutes of Inactivity
 *
 * Key features:
 *   - Listens to mousemove, keydown, click, scroll, and touchstart to detect activity
 *   - Resets a 30-minute countdown timer on every activity event
 *   - On timeout: clears the master key from CryptoProvider, calls sign-out API,
 *     then redirects to /sign-in?reason=inactivity
 *   - Skipped on auth/public pages (sign-in, sign-up, landing page, /api/* paths)
 *   - Uses passive event listeners for scroll/touch to avoid blocking rendering
 *
 * This is a security control (NIST CSF "Protect") to limit exposure if a user
 * walks away from an open session. The E2EE master key is wiped along with the session.
 */
'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCrypto } from './CryptoProvider';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Pages that should NOT trigger inactivity logout
const AUTH_PATHS = ['/sign-in', '/sign-up', '/'];

export default function InactivityProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef(null);
  const { clearKey } = useCrypto();

  const isAuthPage = AUTH_PATHS.includes(pathname) || pathname.startsWith('/api/');

  useEffect(() => {
    if (isAuthPage) return;

    const handleLogout = async () => {
      clearKey();
      await fetch('/api/auth/sign-out', { method: 'POST' });
      router.push('/sign-in?reason=inactivity');
    };

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [pathname]);

  return children;
}
