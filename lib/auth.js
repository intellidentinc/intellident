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

export async function setSession(userId, email, name) {
  const cookieStore = await cookies();
  const userData = JSON.stringify({ userId, email, name });

  cookieStore.set('user', userData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('user');
}
