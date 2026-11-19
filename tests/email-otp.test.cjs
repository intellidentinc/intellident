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

test('OTP is mandatory before, at and after the former judging deadline', () => {
  assert.equal(policyAt(0).isEmailOtpRequired(), true);
  assert.equal(policyAt(deadline - 1).isEmailOtpRequired(), true);
  assert.equal(policyAt(deadline).isEmailOtpRequired(), true);
  assert.equal(policyAt(deadline + 1).isEmailOtpRequired(), true);
});

function signInFixture({ email = 'ordinary@example.invalid', role = 2, valid = true, active = true, enabled = true, mailFails = false } = {}) {
  const user = { id: 'u', email, role, clinicId: role === 0 ? null : 'c', isActive: active, wrappedKey: 'wrapped', keySalt: 'salt', password: 'hash' };
  let finalized = 0;
  let sent = 0;
  let issued = 0;
  const { POST } = load('app/api/auth/sign-in/route.js', ['POST'], {
    NextResponse: { json },
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
    sendMfaOtpEmail: async () => { sent++; if (mailFails) throw new Error('SMTP unavailable'); },
  });
  return { POST, stats: () => ({ finalized, sent, issued }) };
}

test('ordinary, demo and super-admin accounts must verify OTP before session and key handoff', async () => {
  for (const [email, role] of [['admin.maria@intellident.test', 1], ['ordinary@example.invalid', 2], ['superadmin@intellident.app', 0]]) {
    const f = signInFixture({ email, role });
    const res = await f.POST({});
    assert.equal(res.status, 200);
    assert.equal(res.body.mfaPending, true);
    assert.equal(res.body.pendingToken, 'token');
    for (const field of ['wrappedKey', 'keySalt', 'publicKey', 'encryptedPrivateKey', 'privateKeyIv']) assert.equal(res.body[field], undefined);
    assert.deepEqual(f.stats(), { finalized: 0, sent: 1, issued: 1 });
  }
});

test('password, lockout result, account and clinic restrictions precede OTP issuance', async () => {
  for (const [settings, status] of [[{ valid: false }, 401], [{ active: false }, 403], [{ enabled: false }, 403]]) {
    const f = signInFixture(settings);
    const res = await f.POST({});
    assert.equal(res.status, status);
    assert.equal(res.body.wrappedKey, undefined);
    assert.deepEqual(f.stats(), { finalized: 0, sent: 0, issued: 0 });
  }
});

test('login email failure cannot finalize login or return encryption keys', async () => {
  const f = signInFixture({ mailFails: true });
  const res = await f.POST({});
  assert.equal(res.status, 502);
  assert.equal(res.body.pendingToken, undefined);
  assert.equal(res.body.wrappedKey, undefined);
  assert.deepEqual(f.stats(), { finalized: 0, sent: 1, issued: 1 });
});

test('only a verified login challenge releases keys and preserves onboarding flags', async () => {
  for (const verified of [false, true]) {
    let finalized = 0;
    const user = { clinicId: 'c', wrappedKey: 'wrapped', keySalt: 'salt', publicKey: 'public', encryptedPrivateKey: 'private', privateKeyIv: 'iv' };
    const flags = { requiresTerms: true, mustChangePassword: true, passwordExpired: true, requiresStepUp: true };
    const { POST } = load('app/api/auth/verify-otp/route.js', ['POST'], {
      NextResponse: { json },
      getRequestMeta: () => ({ ip: '192.0.2.1' }),
      checkRateLimit: async () => ({ allowed: true }),
      parseJsonBody: async () => ({ body: { pendingToken: 'token', code: '123456' } }),
      hexToken: (value) => value, secret: (value) => value,
      consumeOtp: async ({ purpose }) => {
        assert.equal(purpose, 'login');
        return verified ? { challenge: { user, rememberMe: true } } : { error: 'Invalid code', status: 401 };
      },
      prisma: { clinic: { findUnique: async () => ({ isEnabled: true }) } },
      finalizeLogin: async (args) => {
        finalized++;
        assert.equal(args.user, user);
        assert.equal(args.rememberMe, true);
        return flags;
      },
    });
    const response = await POST({});
    assert.equal(response.status, verified ? 200 : 401);
    assert.equal(finalized, verified ? 1 : 0);
    for (const field of ['wrappedKey', 'keySalt', 'publicKey', 'encryptedPrivateKey', 'privateKeyIv']) {
      assert.equal(response.body[field], verified ? user[field] : undefined);
    }
    if (verified) for (const flag of Object.keys(flags)) assert.equal(response.body[flag], true);
  }
});

test('record-access email failure does not return a challenge or grant access', async () => {
  const session = { userId: 'u', sessionToken: 'session' };
  const { POST } = load('app/api/auth/step-up/send-otp/route.js', ['POST'], {
    NextResponse: { json }, getSession: async () => session,
    checkRateLimit: async () => ({ allowed: true }),
    prisma: { user: { findUnique: async () => ({ email: 'ordinary@example.invalid' }) } },
    issueOtp: async ({ purpose, scope }) => {
      assert.equal(purpose, 'step-up');
      assert.equal(scope, session.sessionToken);
      return { pendingToken: 'token', code: '123456' };
    },
    sendStepUpOtpEmail: async () => { throw new Error('SMTP unavailable'); },
  });
  const response = await POST();
  assert.equal(response.status, 502);
  assert.equal(response.body.pendingToken, undefined);
  assert.equal(recordGate(policyAt(0))(session, 'otp'), false);
});

test('record access requires an unexpired OTP grant and password grants remain separate', () => {
  const session = { userId: 'u', sessionToken: 'session' };
  const before = recordGate(policyAt(deadline - 1));
  const after = recordGate(policyAt(deadline));
  assert.equal(before(session, 'otp'), false);
  assert.equal(before(session, 'password'), false);
  assert.equal(before(session), false);
  assert.equal(before(null, 'otp'), false);
  assert.equal(before({ userId: 'u' }, 'otp'), false);
  assert.equal(after(session, 'otp'), false);
  assert.equal(session.stepUpGrantedAt, undefined);
  const passwordGrant = { ...session, stepUpMode: 'password', stepUpGrantedAt: Date.now() };
  assert.equal(before(passwordGrant, 'password'), true);
  assert.equal(before(passwordGrant, 'otp'), false);
  const otpGrant = { ...session, stepUpMode: 'otp', stepUpGrantedAt: Date.now() };
  assert.equal(before(otpGrant, 'otp'), true);
  assert.equal(before(otpGrant, 'password'), false);
  assert.equal(before({ ...otpGrant, stepUpGrantedAt: Date.now() - 15 * 60 * 1000 }, 'otp'), false);
  assert.equal(before({ ...otpGrant, stepUpGrantedAt: Date.now() + 60000 }, 'otp'), false);
});

test('OTP status and issuance always require verification for existing sessions', async () => {
  for (const time of [deadline - 1, deadline + 1]) {
    const policy = policyAt(time);
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
    assert.equal(status.body.otpRequired, true);
    assert.equal(status.body.valid, false);
    assert.equal(status.headers['Cache-Control'], 'no-store');
    assert.equal((await GET({ url: 'https://example.invalid/api/auth/step-up' })).body.valid, false);
    const { POST } = load('app/api/auth/step-up/send-otp/route.js', ['POST'], mocks);
    const response = await POST();
    assert.equal(response.status, 200);
    assert.equal(response.body.pendingToken, 'token');
    assert.equal(issued, 1);
    assert.equal(sent, 1);
    const anonymous = { ...mocks, getSession: async () => null };
    assert.equal((await load('app/api/auth/step-up/route.js', ['GET'], anonymous).GET({ url: 'https://example.invalid/?mode=otp' })).status, 401);
    assert.equal((await load('app/api/auth/step-up/send-otp/route.js', ['POST'], anonymous).POST()).status, 401);
  }
});

test('verified OTP retains patient ownership and treating-dentist clinic restrictions', async () => {
  const roles = { DENTIST: 2, PATIENT: 4 };
  for (const role of [roles.DENTIST, roles.PATIENT]) {
    for (const authorized of [false, true]) {
      let accessed = 0;
      const session = { userId: 'u', sessionToken: 'session', clinicId: 'clinic-a', stepUpMode: 'otp', stepUpGrantedAt: Date.now() };
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

test('backup restore still requires password step-up and sends its own email OTP', async () => {
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

function resetRequestFixture({ mailFails = false, appUrl = 'https://example.invalid/', user = { isActive: true, firstName: 'Patient' }, allowed = true } = {}) {
  const existing = { token: 'previous-delivered-token', email: 'patient@example.invalid', expiresAt: new Date(Date.now() + 60000) };
  const rows = [existing];
  const messages = [];
  const logs = [];
  const { POST } = load('app/api/auth/forgot-password/route.js', ['POST'], {
    ...crypto, NextResponse: { json },
    process: { env: { NEXT_PUBLIC_APP_URL: appUrl } },
    console: { error: (...args) => logs.push(args) },
    getRequestMeta: () => ({ ip: '192.0.2.1' }),
    checkRateLimit: async () => ({ allowed }),
    parseJsonBody: async () => ({ body: { email: existing.email } }),
    sanitizeEmail: (value) => value,
    prisma: {
      user: { findUnique: async () => user },
      passwordResetToken: {
        create: async ({ data }) => { rows.push(data); },
        deleteMany: async ({ where }) => {
          for (let i = rows.length - 1; i >= 0; i--) {
            if (where.token ? rows[i].token === where.token : rows[i].email === where.email && (!where.expiresAt || rows[i].expiresAt <= where.expiresAt.lte)) rows.splice(i, 1);
          }
        },
      },
    },
    sendPasswordResetEmail: async (message) => {
      messages.push(message);
      if (mailFails) throw Object.assign(new Error('SECRET SMTP CONTENT'), { code: 'EAUTH' });
    },
  });
  return { POST, rows, existing, messages, logs };
}

test('reset email failure preserves delivered links and removes only the failed challenge', async () => {
  const f = resetRequestFixture({ mailFails: true });
  const result = await f.POST({});
  assert.equal(result.status, 502);
  assert.match(result.body.error, /Unable to send/);
  assert.deepEqual(f.rows, [f.existing]);
  assert.doesNotMatch(JSON.stringify(f.logs), /SECRET|patient@example|reset-password\?token=/);
});

test('reset mail contains a valid absolute link while the database stores only its hash', async () => {
  const f = resetRequestFixture();
  assert.equal((await f.POST({})).status, 200);
  assert.equal(f.messages.length, 1);
  const link = new URL(f.messages[0].resetUrl);
  assert.equal(link.origin, 'https://example.invalid');
  assert.equal(link.pathname, '/reset-password');
  const token = link.searchParams.get('token');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(f.rows[1].token, crypto.createHash('sha256').update(token).digest('hex'));
  assert.notEqual(f.rows[1].token, token);
  assert.equal(f.rows[0], f.existing);
});

test('invalid reset URL, inactive accounts and rate limits prevent token issuance and email', async () => {
  for (const [options, status] of [
    [{ appUrl: '' }, 500], [{ appUrl: 'javascript:alert(1)' }, 500],
    [{ user: null }, 200], [{ user: { isActive: false } }, 200],
    [{ user: { isActive: true, isDeleted: true } }, 200], [{ allowed: false }, 429],
  ]) {
    const f = resetRequestFixture(options);
    assert.equal((await f.POST({})).status, status);
    assert.equal(f.messages.length, 0);
    assert.deepEqual(f.rows, [f.existing]);
  }
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
