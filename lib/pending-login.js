'use client';

let pending = null;
let expiryTimer = null;

export function clearPendingLogin() {
  pending = null;
  clearTimeout(expiryTimer);
  expiryTimer = null;
}

export function setPendingLogin(token, password) {
  clearPendingLogin();
  pending = { token, password, expiresAt: Date.now() + 10 * 60 * 1000 };
  expiryTimer = setTimeout(clearPendingLogin, 10 * 60 * 1000);
}

export function getPendingLogin(token) {
  if (!pending || pending.token !== token || pending.expiresAt <= Date.now()) {
    clearPendingLogin();
    return null;
  }
  return pending;
}
