/**
 * lib/login.js — Post-authentication finalize step.
 *
 * Runs AFTER the credential check (sign-in) and the MFA OTP check (verify-otp) have both
 * passed. Performs device fingerprinting, suspicious-session detection, single-session
 * termination, session creation, audit logging, and the suspicious-login email — then
 * returns the routing flags the client needs.
 *
 * Centralizing this here keeps sign-in and verify-otp in lockstep so newer login features
 * (terms gate, forced password change, password expiry, step-up) can never drift apart.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sendSuspiciousLoginAlert } from '@/lib/email';

/**
 * @param {object}  args
 * @param {object}  args.user    - User row: id, email, firstName, lastName, clinicId, role,
 *                                  termsAcceptedAt, mustChangePassword, passwordExpiresAt
 * @param {object?} args.clinic  - Clinic row: passwordExpiryEnabled, passwordExpiryRoles, singleSessionEnabled (or null)
 * @param {boolean} args.rememberMe
 * @param {string?} args.ip
 * @param {string?} args.userAgent
 * @returns {Promise<{ requiresTerms?: true, mustChangePassword?: true, passwordExpired?: true, requiresStepUp?: true }>}
 */
export async function finalizeLogin({ user, clinic, rememberMe, ip, userAgent }) {
  const uaHash = crypto.createHash('sha256').update(userAgent ?? '').digest('hex');

  // Single-session termination + device fingerprint lookup in parallel.
  const [, knownDevice] = await Promise.all([
    clinic?.singleSessionEnabled
      ? prisma.userSession.updateMany({
          where: { userId: user.id, terminatedAt: null },
          data: { terminatedAt: new Date() },
        })
      : Promise.resolve(),
    prisma.knownDevice.findUnique({
      where: { userId_userAgentHash: { userId: user.id, userAgentHash: uaHash } },
      select: { lastIp: true },
    }),
  ]);

  const isNewDevice  = !knownDevice;
  const suspiciousIp = !isNewDevice && knownDevice.lastIp !== null && knownDevice.lastIp !== ip;
  const requiresTerms = !user.termsAcceptedAt;
  const suspicious = isNewDevice || suspiciousIp;

  // Device upsert + session creation in parallel.
  await Promise.all([
    prisma.knownDevice.upsert({
      where:  { userId_userAgentHash: { userId: user.id, userAgentHash: uaHash } },
      create: { userId: user.id, userAgentHash: uaHash, lastIp: ip },
      update: { lastIp: ip, lastSeenAt: new Date() },
    }),
    setSession(user.id, user.email, user.firstName, user.lastName, user.clinicId,
               rememberMe, false, requiresTerms, ip, userAgent, user.role, suspicious),
  ]);

  logAudit({
    userId: user.id, clinicId: user.clinicId,
    action: 'LOGIN', entity: 'User', entityId: user.id,
    ipAddress: ip, userAgent,
    metadata: {
      ...(isNewDevice  ? { newDevice: true }                                     : {}),
      ...(suspiciousIp ? { suspiciousIp: true, previousIp: knownDevice.lastIp }  : {}),
    },
  });

  if (isNewDevice || suspiciousIp) {
    sendSuspiciousLoginAlert({
      to: user.email, firstName: user.firstName,
      isNewDevice, suspiciousIp,
      previousIp: suspiciousIp ? knownDevice.lastIp : null,
      ip, time: new Date(),
    }).catch(() => {});
  }

  const mustChangePassword = user.mustChangePassword ?? false;
  const passwordExpired =
    clinic?.passwordExpiryEnabled === true &&
    Array.isArray(clinic.passwordExpiryRoles) &&
    clinic.passwordExpiryRoles.includes(user.role) &&
    user.passwordExpiresAt instanceof Date &&
    user.passwordExpiresAt < new Date();

  return {
    ...(requiresTerms      && { requiresTerms: true }),
    ...(mustChangePassword && { mustChangePassword: true }),
    ...(passwordExpired    && { passwordExpired: true }),
    ...(suspicious         && { requiresStepUp: true }),
  };
}
