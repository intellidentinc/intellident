/**
 * lib/auth.js — Session Management
 *
 * Custom cookie-based session (no NextAuth / JWT library).
 * Session data is stored as a JSON string in an httpOnly cookie named 'user'.
 *
 * Session durations:
 *   - Default    → 10 minutes  (short-lived for security)
 *   - Remember Me → 3 days     (opt-in on sign-in page)
 *
 * The session only stores non-sensitive identifiers (userId, email, name, clinicId).
 * The E2EE master key is NEVER stored in the session — it lives in CryptoProvider
 * memory only and is cleared on sign-out or after 30 minutes of inactivity.
 */
import { cookies } from 'next/headers';

export async function getSession() {
  const cookieStore = await cookies();
  const userDataStr = cookieStore.get('user')?.value;

  if (!userDataStr) return null;

  try {
    return JSON.parse(userDataStr);
  } catch {
    return null;
  }
}

export async function setSession(userId, email, firstName, lastName, clinicId, rememberMe = false, superAdmin = false, requiresTerms = false) {
  const cookieStore = await cookies();
  const payload = { userId, email, firstName, lastName, clinicId: clinicId || null, rememberMe: !!rememberMe, sessionCreatedAt: Date.now() };
  if (superAdmin) payload.superAdmin = true;
  if (requiresTerms) payload.requiresTerms = true;
  const userData = JSON.stringify(payload);

  cookieStore.set('user', userData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: rememberMe ? 60 * 60 * 24 * 3 : 60 * 10 // 3 days or 10 minutes
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('user');
}
