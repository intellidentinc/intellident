const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load(file, names, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '')
    .replace(/\bexport (?=(?:async )?function|const)/g, '');
  const context = vm.createContext({ Buffer, Date, URL, console: { error() {} }, process: { env: {} }, ...mocks });
  vm.runInContext(`${source}\nglobalThis.exports = { ${names.join(', ')} };`, context);
  return context.exports;
}

const deadline = Date.parse('2026-11-17T15:31:29.891Z');
function policyAt(time) {
  class Clock extends Date { static now() { return time; } }
  return load('lib/email-otp-policy.js', ['isEmailOtpRequired'], { Date: Clock });
}
function recordGate(policy) {
  return load('lib/auth.js', ['isStepUpValid'], { ...policy, cache: (fn) => fn }).isStepUpValid;
}
const json = (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers });

test('fixed judging deadline restores OTP exactly at expiry without environment settings', () => {
  assert.equal(policyAt(deadline - 1).isEmailOtpRequired(), false);
  assert.equal(policyAt(deadline).isEmailOtpRequired(), true);
  assert.equal(policyAt(deadline + 1).isEmailOtpRequired(), true);
});

function signInFixture({ required = false, email = 'ordinary@example.invalid', valid = true, active = true, enabled = true } = {}) {
  const user = { id: 'u', email, role: 2, clinicId: 'c', isActive: active, wrappedKey: 'wrapped', keySalt: 'salt', password: 'hash' };
  let finalized = 0;
  let sent = 0;
  let issued = 0;
  const { POST } = load('app/api/auth/sign-in/route.js', ['POST'], {
    NextResponse: { json }, isEmailOtpRequired: () => required,
    getRequestMeta: () => ({ ip: '192.0.2.1' }),
    checkRateLimit: async () => ({ allowed: true }),
    parseJsonBody: async () => ({ body: { email, password: 'correct', rememberMe: true } }),
    sanitizeEmail: (v) => v, secret: (v) => v, bool: (v) => !!v,
    prisma: { user: { findUnique: async () => user }, clinic: { findUnique: async () => ({ isEnabled: enabled }) } },
    verifyLoginPassword: async () => ({ valid, user }),
    finalizeLogin: async (args) => {
      finalized++;
      assert.equal(args.user, user);
      assert.equal(args.rememberMe, true);
      return { requiresTerms: true, mustChangePassword: true, passwordExpired: true, requiresStepUp: true };
    },
    issueOtp: async () => { issued++; return { pendingToken: 'token', code: '123456' }; },
    sendMfaOtpEmail: async () => { sent++; },
  });
  return { POST, stats: () => ({ finalized, sent, issued }) };
}

test('ordinary and demo accounts sign in directly during judging and retain key material and routing flags', async () => {
  for (const email of ['admin.maria@intellident.test', 'ordinary@example.invalid', 'superadmin@intellident.app']) {
    const f = signInFixture({ email });
    const res = await f.POST({});
    assert.equal(res.status, 200);
    assert.equal(res.body.mfaPending, undefined);
    assert.equal(res.body.pendingToken, undefined);
    assert.equal(res.body.wrappedKey, 'wrapped');
    assert.equal(res.body.keySalt, 'salt');
    for (const flag of ['requiresTerms', 'mustChangePassword', 'passwordExpired', 'requiresStepUp']) assert.equal(res.body[flag], true);
    assert.deepEqual(f.stats(), { finalized: 1, sent: 0, issued: 0 });
  }
});

test('password, lockout result, account and clinic restrictions precede temporary OTP waiver', async () => {
  for (const [settings, status] of [[{ valid: false }, 401], [{ active: false }, 403], [{ enabled: false }, 403]]) {
    const f = signInFixture(settings);
    const res = await f.POST({});
    assert.equal(res.status, status);
    assert.equal(res.body.wrappedKey, undefined);
    assert.deepEqual(f.stats(), { finalized: 0, sent: 0, issued: 0 });
  }
});

test('after judging login sends OTP and withholds session and keys', async () => {
  const f = signInFixture({ required: policyAt(deadline).isEmailOtpRequired() });
  const res = await f.POST({});
  assert.equal(res.status, 200);
  assert.equal(res.body.mfaPending, true);
  assert.equal(res.body.wrappedKey, undefined);
  assert.deepEqual(f.stats(), { finalized: 0, sent: 1, issued: 1 });
});

test('record waiver applies only to authenticated OTP checks and leaves no grant after expiry', () => {
  const session = { userId: 'u', sessionToken: 'session' };
  const before = recordGate(policyAt(deadline - 1));
  const after = recordGate(policyAt(deadline));
  assert.equal(before(session, 'otp'), true);
  assert.equal(before(session, 'password'), false);
  assert.equal(before(session), false);
  assert.equal(before(null, 'otp'), false);
  assert.equal(before({ userId: 'u' }, 'otp'), false);
  assert.equal(after(session, 'otp'), false);
  assert.equal(session.stepUpGrantedAt, undefined);
  const passwordGrant = { ...session, stepUpMode: 'password', stepUpGrantedAt: Date.now() };
  assert.equal(before(passwordGrant, 'password'), true);
});

test('OTP status and issuance endpoints require a session and return waiver without creating or sending OTP', async () => {
  for (const required of [false, true]) {
    const policy = { isEmailOtpRequired: () => required };
    const session = { userId: 'u', sessionToken: 'session' };
    let sent = 0;
    let issued = 0;
    const mocks = {
      ...policy, NextResponse: { json }, isStepUpValid: recordGate(policy),
      getSession: async () => session,
      checkRateLimit: async () => ({ allowed: true }),
      prisma: { user: { findUnique: async () => ({ email: 'ordinary@example.invalid' }) } },
      issueOtp: async () => { issued++; return { pendingToken: 'token', code: '123456' }; },
      sendStepUpOtpEmail: async () => { sent++; },
    };
    const { GET } = load('app/api/auth/step-up/route.js', ['GET'], mocks);
    const status = await GET({ url: 'https://example.invalid/api/auth/step-up?mode=otp' });
    assert.equal(status.body.otpRequired, required);
    assert.equal(status.body.valid, !required);
    assert.equal(status.headers['Cache-Control'], 'no-store');
    assert.equal((await GET({ url: 'https://example.invalid/api/auth/step-up' })).body.valid, false);
    const { POST } = load('app/api/auth/step-up/send-otp/route.js', ['POST'], mocks);
    const response = await POST();
    assert.equal(response.status, 200);
    assert.equal(response.body.otpRequired, required ? undefined : false);
    assert.equal(issued, required ? 1 : 0);
    assert.equal(sent, required ? 1 : 0);
    const anonymous = { ...mocks, getSession: async () => null };
    assert.equal((await load('app/api/auth/step-up/route.js', ['GET'], anonymous).GET({ url: 'https://example.invalid/?mode=otp' })).status, 401);
    assert.equal((await load('app/api/auth/step-up/send-otp/route.js', ['POST'], anonymous).POST()).status, 401);
  }
});

test('record waiver retains patient ownership and treating-dentist clinic restrictions', async () => {
  const roles = { DENTIST: 2, PATIENT: 4 };
  for (const role of [roles.DENTIST, roles.PATIENT]) {
    for (const authorized of [false, true]) {
      let accessed = 0;
      const session = { userId: 'u', sessionToken: 'session', clinicId: 'clinic-a' };
      const { GET } = load('app/api/records/[patientId]/recipients/route.js', ['GET'], {
        NextResponse: { json }, ROLES: roles,
        getSession: async () => session,
        getAuthContext: async () => ({ ...session, role }),
        isStepUpValid: recordGate(policyAt(deadline - 1)),
        getRecordsDentist: async () => ({ dentistId: 'dentist', clinicId: 'clinic-a' }),
        dentistTreatsPatient: async (args) => { assert.equal(args.clinicId, 'clinic-a'); return authorized; },
        prisma: { patient: { findFirst: async ({ where }) => {
          assert.equal(where.clinicId, 'clinic-a'); assert.equal(where.userId, 'u');
          return authorized ? { id: 'patient' } : null;
        } } },
        getRecordRecipients: async ({ clinicId }) => { assert.equal(clinicId, 'clinic-a'); accessed++; return { recipients: [] }; },
      });
      const res = await GET({}, { params: Promise.resolve({ patientId: 'patient' }) });
      assert.equal(res.status, authorized ? 200 : 404);
      assert.equal(accessed, authorized ? 1 : 0);
    }
  }
});

test('backup restore still requires password step-up and sends its own email OTP during judging', async () => {
  const policy = policyAt(deadline - 1);
  const session = { userId: 'admin', sessionToken: 'session' };
  let issued = 0;
  let sent = 0;
  const pending = [];
  const { POST } = load('app/api/super/clinics/[id]/restore/request-otp/route.js', ['POST'], {
    NextResponse: { json }, ROLES: { SUPERADMIN: 0 },
    getSession: async () => session,
    getAuthContext: async () => ({ role: 0, email: 'admin@example.invalid' }),
    isStepUpValid: recordGate(policy),
    getRequestMeta: () => ({ ip: '192.0.2.1' }), logAudit: () => {},
    checkRateLimit: async () => ({ allowed: true }),
    prisma: { clinic: { findUnique: async () => ({ id: 'clinic', name: 'Clinic' }) }, mfaOtp: { updateMany: async () => {} } },
    issueOtp: async ({ purpose }) => { assert.equal(purpose, 'restore'); issued++; return { pendingToken: 'restore-token', code: '123456' }; },
    sendRestoreOtpEmail: async ({ code }) => { assert.equal(code, '123456'); sent++; },
    after: (promise) => { pending.push(promise); },
  });
  assert.equal((await POST({}, { params: Promise.resolve({ id: 'clinic' }) })).status, 403);
  assert.equal(issued, 0);
  session.stepUpMode = 'password'; session.stepUpGrantedAt = Date.now();
  const res = await POST({}, { params: Promise.resolve({ id: 'clinic' }) });
  await Promise.all(pending);
  assert.equal(res.status, 200);
  assert.equal(res.body.pendingToken, 'restore-token');
  assert.equal(issued, 1);
  assert.equal(sent, 1);
});

async function otpFixture(purpose = 'login', scope = '') {
  const user = { id: 'user', password: 'hash', email: 'test@example.invalid', role: 2, isActive: true, isDeleted: false };
  let row;
  const table = {
    create: async ({ data }) => { row = { id: 'otp', attempts: 0, usedAt: null, ...data, user }; },
    findUnique: async ({ where }) => row?.pendingToken === where.pendingToken ? row : null,
    update: async ({ data }) => { if (data.attempts) row.attempts++; if (data.usedAt) row.usedAt = data.usedAt; },
  };
  const tx = { $executeRaw: async () => {}, mfaOtp: table };
  const api = load('lib/otp.js', ['issueOtp', 'consumeOtp'], {
    ...crypto, randomInt: () => 123456,
    bcrypt: { hash: async (code) => `hash-${code}`, compare: async (code, hash) => hash === `hash-${code}` },
    prisma: { user: { findUnique: async () => user }, mfaOtp: table, $transaction: async (cb) => cb(tx) },
  });
  const issued = await api.issueOtp({ userId: user.id, purpose, scope, expectedPasswordHash: user.password });
  return { ...api, issued, row, user, consume: (changes = {}) => api.consumeOtp({ pendingToken: issued.pendingToken, code: issued.code, purpose, scope, ...changes }) };
}

test('emailed OTP consumes a challenge once and rejects the former shared code', async () => {
  const f = await otpFixture();
  assert.ok((await f.consume({ code: '654321' })).error);
  assert.ok((await f.consume()).challenge);
  assert.ok((await f.consume()).error);
});

test('emailed OTP retains expiry, attempts, account, token, purpose and session restrictions', async () => {
  const cases = [
    (f) => { f.row.expiresAt = new Date(0); },
    (f) => { f.row.attempts = 5; },
    (f) => { f.user.isActive = false; },
    (f) => { f.user.isDeleted = true; },
    (f) => { f.user.password = 'changed'; },
    (f) => { f.user.email = 'changed@example.invalid'; },
    (f) => { f.user.role = 0; },
    (f) => { f.row.usedAt = new Date(); },
  ];
  for (const mutate of cases) { const f = await otpFixture(); mutate(f); assert.ok((await f.consume()).error); }
  const f = await otpFixture('step-up', 'session-1');
  for (const changes of [{ pendingToken: 'bogus' }, { purpose: 'login' }, { scope: 'session-2' }, { userId: 'other' }]) {
    assert.ok((await f.consume(changes)).error);
  }
  assert.ok((await f.consume()).challenge);
  const restore = await otpFixture('restore', 'clinic');
  assert.ok((await restore.consume({ code: '654321' })).error);
  assert.ok((await restore.consume()).challenge);
  const wrong = await otpFixture();
  for (let i = 0; i < 5; i++) assert.ok((await wrong.consume({ code: 'wrong' })).error);
  assert.equal((await wrong.consume()).status, 429);
});

test('mail normalizes configuration, bounds timeouts, and sanitizes errors', async () => {
  const env = { GMAIL_USER: ' sender@example.invalid ', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' };
  let config;
  let message;
  let fail = false;
  const logs = [];
  const { sendMfaOtpEmail } = load('lib/email.js', ['sendMfaOtpEmail'], {
    process: { env }, console: { error: (...args) => logs.push(args) },
    nodemailer: { createTransport: (options) => {
      config = options;
      return { sendMail: async (mail) => {
        message = mail;
        if (fail) throw Object.assign(new Error('SECRET SMTP CONTENT'), { code: 'EAUTH', responseCode: 535 });
        return { accepted: [mail.to], rejected: [] };
      } };
    } },
  });
  await sendMfaOtpEmail({ to: 'recipient@example.invalid', code: '123456' });
  assert.equal(config.auth.pass, 'abcdefghijklmnop');
  assert.equal(config.auth.user, 'sender@example.invalid');
  assert.equal(config.socketTimeout, 15000);
  assert.match(message.from, /<sender@example.invalid>/);
  fail = true;
  await assert.rejects(sendMfaOtpEmail({ to: 'recipient@example.invalid', code: '123456' }), /Replace.*App Password/);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|123456|recipient/);
  env.GMAIL_APP_PASSWORD = '';
  await assert.rejects(sendMfaOtpEmail({ to: 'recipient@example.invalid', code: '123456' }));
});

function notificationFixture({ fail = false, custom = false } = {}) {
  let release;
  let deliveries = 0;
  let bells = 0;
  let logged = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const send = async () => { deliveries++; await gate; if (fail) throw new Error('SMTP failure'); };
  const api = load('lib/notifications.js', ['notifyPatientStatusChange', 'sendAppointmentReminder'], {
    moment: () => ({ tz: () => ({ format: () => 'date' }) }),
    console: { error: () => { logged++; } },
    prisma: {
      clinic: { findUnique: async () => ({ notifConfig: custom ? { APPOINTMENT_CONFIRMED: { emailSubject: 'Custom' }, REMINDER_24H: { emailSubject: 'Custom' } } : {} }) },
      inAppNotification: { create: async () => { bells++; }, findFirst: async () => bells ? { id: 'existing' } : null },
    },
    sendCustomAppointmentEmail: send, sendAppointmentConfirmedEmail: send, sendAppointmentReminderEmail: send,
  });
  return { ...api, release, stats: () => ({ deliveries, bells, logged }) };
}

test('status notifications await default and custom mail while tolerating delivery failure', async () => {
  for (const custom of [false, true]) {
    const f = notificationFixture({ fail: true, custom });
    let done = false;
    const pending = f.notifyPatientStatusChange({ userId: 'u', clinicId: 'c', status: 'CONFIRMED', patientEmail: 'r@example.invalid' }).then(() => { done = true; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.stats().deliveries, 1);
    assert.equal(done, false);
    f.release(); await pending;
    assert.equal(f.stats().logged, 1);
  }
});

test('reminder failure allows retry without duplicating the bell notification', async () => {
  const f = notificationFixture({ fail: true });
  const args = { appointment: { id: 'a', clinicId: 'c', patient: { user: { id: 'u', email: 'r@example.invalid' } } }, hoursAhead: 24 };
  const pending = f.sendAppointmentReminder(args);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.stats().deliveries, 1);
  f.release();
  assert.equal((await pending).delivered, false);
  assert.equal((await f.sendAppointmentReminder(args)).delivered, false);
  assert.equal(f.stats().bells, 1);
  const success = notificationFixture(); success.release();
  assert.equal((await success.sendAppointmentReminder(args)).delivered, true);
});

test('reminder cron keeps failed items eligible and continues to later appointments', async () => {
  const marked = [];
  const { GET } = load('app/api/cron/reminders/route.js', ['GET'], {
    isAuthorizedCron: () => true,
    NextResponse: { json: (body) => body },
    prisma: {
      clinic: { findMany: async () => [{ id: 'c' }] },
      appointment: {
        findMany: async ({ where }) => where.reminderSent24h === false ? [{ id: 'failed' }, { id: 'success' }] : [],
        update: async ({ where }) => { marked.push(where.id); },
      },
    },
    sendAppointmentReminder: async ({ appointment }) => ({ delivered: appointment.id !== 'failed' }),
  });
  const result = await GET({});
  assert.deepEqual(marked, ['success']);
  assert.equal(result.sent1, 1);
});
