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

export async function setSession(userId, email, firstName, lastName, clinicId, rememberMe = false) {
  const cookieStore = await cookies();
  const userData = JSON.stringify({ userId, email, firstName, lastName, clinicId: clinicId || null });

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
