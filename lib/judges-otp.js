import { timingSafeEqual } from 'crypto';

// Server-only configuration. A fixed deadline prevents restarts extending access.
export function judgesOtpEnabled(purpose) {
  if (purpose !== 'login' && purpose !== 'step-up') return false;
  const deadline = process.env.JUDGES_OTP_BYPASS_EXPIRES_AT;
  return process.env.JUDGES_OTP_BYPASS_ENABLED === 'true' &&
    /^\d{6}$/.test(process.env.JUDGES_OTP_BYPASS_CODE || '') &&
    typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(deadline) &&
    Number.isFinite(Date.parse(deadline)) && Date.now() < Date.parse(deadline);
}

export function matchesJudgesOtp(code, purpose) {
  if (!judgesOtpEnabled(purpose) || typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
  return timingSafeEqual(Buffer.from(code), Buffer.from(process.env.JUDGES_OTP_BYPASS_CODE));
}
