// Fixed judging window, shared by sign-in and record-access authorization.
// Runtime check: deployments/restarts never extend it, and no cookie stores a waiver.
const JUDGING_ENDS_AT = Date.parse('2026-11-17T15:31:29.891Z');

export function isEmailOtpRequired() {
  return Date.now() >= JUDGING_ENDS_AT;
}
