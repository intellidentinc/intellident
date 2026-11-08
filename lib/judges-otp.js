import { createHash, timingSafeEqual } from 'crypto';

// Deployment-safe demo fallback: hash only, never the private plaintext code.
// Fixed to the original judging window; restarting/redeploying cannot extend it.
const DEMO_DEADLINE = '2026-11-17T15:31:29.891Z';
const DEMO_CODE_HASH = '735965ac10a1cf95b2b1f3b1ba20255b75616b587938ca15b9ebb305dc3abfbf';

function judgesCodeHash(purpose, email) {
  if (purpose !== 'login' && purpose !== 'step-up') return null;
  const configured = ['JUDGES_OTP_BYPASS_ENABLED', 'JUDGES_OTP_BYPASS_CODE', 'JUDGES_OTP_BYPASS_EXPIRES_AT']
    .some((key) => process.env[key] !== undefined);
  if (!configured) {
    const isDemo = typeof email === 'string' && /^(admin|dentist|receptionist|patient)\.(maria|kh|cabasal)@intellident\.test$/.test(email);
    return isDemo && Date.now() < Date.parse(DEMO_DEADLINE) ? DEMO_CODE_HASH : null;
  }
  const deadline = process.env.JUDGES_OTP_BYPASS_EXPIRES_AT;
  if (process.env.JUDGES_OTP_BYPASS_ENABLED !== 'true' ||
    !/^\d{6}$/.test(process.env.JUDGES_OTP_BYPASS_CODE || '') ||
    typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(deadline) ||
    !Number.isFinite(Date.parse(deadline)) || Date.now() >= Date.parse(deadline)) return null;
  return createHash('sha256').update(process.env.JUDGES_OTP_BYPASS_CODE).digest('hex');
}

// Server-only configuration. A fixed deadline prevents restarts extending access.
export function judgesOtpEnabled(purpose, email) {
  return judgesCodeHash(purpose, email) !== null;
}

export function matchesJudgesOtp(code, purpose, email) {
  const expectedHash = judgesCodeHash(purpose, email);
  if (!expectedHash || typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
  return timingSafeEqual(createHash('sha256').update(code).digest(), Buffer.from(expectedHash, 'hex'));
}
