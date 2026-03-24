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
