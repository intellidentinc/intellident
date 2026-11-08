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
  const context = vm.createContext({ Buffer, Date, console: { error() {} }, process: { env: {} }, ...mocks });
  vm.runInContext(`${source}\nglobalThis.exports = { ${names.join(', ')} };`, context);
  return context.exports;
}

function judges(env = {}) {
  return load('lib/judges-otp.js', ['judgesOtpEnabled', 'matchesJudgesOtp'], {
    timingSafeEqual: crypto.timingSafeEqual, process: { env },
  });
}
const enabledEnv = () => ({
  JUDGES_OTP_BYPASS_ENABLED: 'true', JUDGES_OTP_BYPASS_CODE: '654321',
  JUDGES_OTP_BYPASS_EXPIRES_AT: new Date(Date.now() + 86400000).toISOString(),
});

test('judges configuration fails closed and restricts OTP purposes', () => {
  const env = enabledEnv();
  const helper = judges(env);
  assert.equal(helper.matchesJudgesOtp('654321', 'login'), true);
  assert.equal(helper.matchesJudgesOtp('654321', 'step-up'), true);
  assert.equal(helper.matchesJudgesOtp('654321', 'restore'), false);
  assert.equal(helper.matchesJudgesOtp('123456', 'login'), false);
  assert.equal(helper.matchesJudgesOtp(null, 'login'), false);
  for (const patch of [
    { JUDGES_OTP_BYPASS_ENABLED: 'false' }, { JUDGES_OTP_BYPASS_CODE: '' },
    { JUDGES_OTP_BYPASS_CODE: 'abcdef' }, { JUDGES_OTP_BYPASS_EXPIRES_AT: '' },
    { JUDGES_OTP_BYPASS_EXPIRES_AT: 'invalid' }, { JUDGES_OTP_BYPASS_EXPIRES_AT: '2099-01-01' },
    { JUDGES_OTP_BYPASS_EXPIRES_AT: new Date(Date.now() - 1000).toISOString() },
  ]) assert.equal(judges({ ...env, ...patch }).matchesJudgesOtp('654321', 'login'), false);
});

async function otpFixture(purpose = 'login', scope = '') {
  const user = { id: 'user', password: 'hash', email: 'test@example.invalid', role: 2, isActive: true, isDeleted: false };
  const env = enabledEnv();
  let row;
  const table = {
    create: async ({ data }) => { row = { id: 'otp', attempts: 0, usedAt: null, ...data, user }; },
    findUnique: async ({ where }) => row?.pendingToken === where.pendingToken ? row : null,
    update: async ({ data }) => { if (data.attempts) row.attempts++; if (data.usedAt) row.usedAt = data.usedAt; },
  };
  const tx = { $executeRaw: async () => {}, mfaOtp: table };
  const api = load('lib/otp.js', ['issueOtp', 'consumeOtp'], {
    ...crypto, randomInt: () => 123456, ...judges(env),
    bcrypt: { hash: async (code) => `hash-${code}`, compare: async (code, hash) => hash === `hash-${code}` },
    prisma: { user: { findUnique: async () => user }, mfaOtp: table, $transaction: async (cb) => cb(tx) },
  });
  const issued = await api.issueOtp({ userId: user.id, purpose, scope, expectedPasswordHash: user.password });
  return { ...api, issued, row, user, env, consume: (changes = {}) => api.consumeOtp({ pendingToken: issued.pendingToken, code: '654321', purpose, scope, ...changes }) };
}

test('judges code consumes a real challenge once and normal emailed codes still work', async () => {
  const f = await otpFixture();
  assert.equal((await f.consume()).judgesBypass, true);
  assert.ok((await f.consume()).error);
  const normal = await otpFixture();
  normal.env.JUDGES_OTP_BYPASS_ENABLED = 'false';
  assert.ok((await normal.consume()).error);
  assert.ok((await normal.consume({ code: normal.issued.code })).challenge);
});

test('judges code retains expiry, attempts, account, token, purpose and session restrictions', async () => {
  const cases = [
    (f) => { f.row.expiresAt = new Date(0); },
    (f) => { f.row.attempts = 5; },
    (f) => { f.user.isActive = false; },
    (f) => { f.user.isDeleted = true; },
    (f) => { f.user.password = 'changed'; },
    (f) => { f.user.email = 'changed@example.invalid'; },
    (f) => { f.user.role = 0; },
    (f) => { f.row.usedAt = new Date(); },
    (f) => { f.env.JUDGES_OTP_BYPASS_EXPIRES_AT = new Date(0).toISOString(); },
  ];
  for (const mutate of cases) { const f = await otpFixture(); mutate(f); assert.ok((await f.consume()).error); }
  const f = await otpFixture('step-up', 'session-1');
  for (const changes of [{ pendingToken: 'bogus' }, { purpose: 'login' }, { scope: 'session-2' }, { userId: 'other' }]) {
    assert.ok((await f.consume(changes)).error);
  }
  assert.equal((await f.consume()).judgesBypass, true);
  const restore = await otpFixture('restore', 'clinic');
  assert.ok((await restore.consume()).error);
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

test('OTP issuance skips mail only while judges mode is active and never returns the code', async () => {
  for (const active of [true, false]) {
    let sent = 0;
    let issued = 0;
    const user = { id: 'u', email: 'r@example.invalid', isActive: true, wrappedKey: 'wrapped', keySalt: 'salt', password: 'hash' };
    const common = {
      NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
      judgesOtpEnabled: () => active,
      checkRateLimit: async () => ({ allowed: true }),
      prisma: { user: { findUnique: async () => user } },
      issueOtp: async () => { issued++; return { pendingToken: 'token', code: '123456' }; },
      sendMfaOtpEmail: async () => { sent++; throw new Error('offline'); },
      sendStepUpOtpEmail: async () => { sent++; throw new Error('offline'); },
      getSession: async () => ({ userId: 'u', sessionToken: 'session' }),
      getRequestMeta: () => ({ ip: '192.0.2.1' }),
      parseJsonBody: async () => ({ body: { email: user.email, password: 'correct' } }),
      sanitizeEmail: (v) => v, secret: (v) => v, bool: (v) => !!v,
      verifyLoginPassword: async () => ({ valid: true, user }),
    };
    for (const file of ['app/api/auth/sign-in/route.js', 'app/api/auth/step-up/send-otp/route.js']) {
      const { POST } = load(file, ['POST'], common);
      const result = await POST({});
      assert.equal(result.status, active ? 200 : 502);
      assert.equal(result.body.code, undefined);
      assert.equal(result.body.wrappedKey, undefined);
      if (active) assert.equal(result.body.pendingToken, 'token');
    }
    assert.equal(sent, active ? 0 : 2);
    assert.equal(issued, 2);
  }
});

test('successful judges verification is audited without returning the bypass marker or code', async () => {
  const entries = [];
  const common = {
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
    getRequestMeta: () => ({ ip: '192.0.2.1' }),
    checkRateLimit: async () => ({ allowed: true }),
    parseJsonBody: async () => ({ body: { pendingToken: 'token', code: '654321' } }),
    hexToken: (v) => v, secret: (v) => v,
    consumeOtp: async () => ({ challenge: { user: { id: 'u' }, rememberMe: false }, judgesBypass: true }),
    finalizeLogin: async () => ({}),
    logAudit: async (entry) => { entries.push(entry); },
    getSession: async () => ({ userId: 'u', sessionToken: 'session' }),
    grantStepUp: async () => true,
  };
  for (const file of ['app/api/auth/verify-otp/route.js', 'app/api/auth/step-up/route.js']) {
    const { POST } = load(file, ['POST'], common);
    const response = await POST({});
    assert.equal(response.status, 200);
    assert.equal(response.body.judgesBypass, undefined);
  }
  assert.equal(entries.length, 2);
  assert.equal(entries[0].metadata.mode, 'judges-bypass');
  assert.equal(entries[1].metadata.judgesBypass, true);
  assert.doesNotMatch(JSON.stringify(entries), /654321/);
});
