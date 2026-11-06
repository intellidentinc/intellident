const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual handlers with isolated service boundaries. No Next server,
// credentials, database, mail, or storage connections are used by these tests.
function load(relativePath, names, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
    .replace(/^import .*\r?\n/gm, '')
    .replace(/\bexport (?=(?:async )?function|const)/g, '');
  const context = vm.createContext({
    console, Date, Buffer, process: { env: {} },
    NextResponse: { json: (body, options = {}) => ({ status: options.status ?? 200, body }) },
    ...mocks,
  });
  vm.runInContext(`${source}\nglobalThis.testExports = { ${names.join(', ')} };`, context, { filename: relativePath });
  return context.testExports;
}

const userFixture = () => ({
  id: 'fixture-user', email: 'fixture@example.invalid', firstName: 'Fixture',
  password: 'current-hash', clinicId: 'fixture-clinic', role: 2,
  isActive: true, isDeleted: false, wrappedKey: 'wrapped', keySalt: 'salt',
  passwordHistory: [], failedLoginAttempts: 0, lastFailedAt: null, lockedUntil: null,
});

function loginFixture(overrides = {}, env = {}) {
  const user = { ...userFixture(), ...overrides };
  let queue = Promise.resolve();
  let comparisons = 0;
  const prisma = {
    user: { findUnique: async () => structuredClone(user) },
    clinic: { findUnique: async () => ({ isEnabled: true }) },
    $transaction: async (callback) => {
      let release;
      let locked = false;
      const tx = {
        $queryRaw: async (strings, id) => {
          assert.match(strings.join('?'), /FOR UPDATE/);
          assert.equal(id, user.id);
          const previous = queue;
          queue = new Promise((resolve) => { release = resolve; });
          await previous;
          locked = true;
          return [{ id }];
        },
        user: {
          findUnique: async () => {
            assert.ok(locked, 'Read fresh account state only after taking the lock');
            return structuredClone(user);
          },
          update: async ({ data }) => {
            assert.ok(locked, 'Update login state under the same row lock');
            Object.assign(user, data);
            return structuredClone(user);
          },
        },
      };
      try { return await callback(tx); } finally { if (release) release(); }
    },
  };
  const bcrypt = { compare: async (password, hash) => { comparisons++; return password === 'correct' && hash === 'current-hash'; } };
  const { verifyLoginPassword } = load('lib/login-attempts.js', ['verifyLoginPassword'], { prisma, bcrypt, process: { env } });
  return { user, prisma, bcrypt, verifyLoginPassword, comparisons: () => comparisons };
}

test('concurrent failures from three attempts reach five and lock the account', async () => {
  const fixture = loginFixture({ failedLoginAttempts: 3, lastFailedAt: new Date() });
  const results = await Promise.all([
    fixture.verifyLoginPassword(fixture.user.id, 'wrong'),
    fixture.verifyLoginPassword(fixture.user.id, 'wrong'),
  ]);
  assert.deepEqual(results.map((result) => result.attempts), [4, 5]);
  assert.equal(fixture.user.failedLoginAttempts, 5);
  assert.ok(fixture.user.lockedUntil > new Date());
  assert.equal(results.filter((result) => result.newlyLocked).length, 1);
});

test('a parallel burst stops password checks at the lockout threshold', async () => {
  const fixture = loginFixture();
  const results = await Promise.all(Array.from({ length: 20 }, () => fixture.verifyLoginPassword(fixture.user.id, 'wrong')));
  assert.ok(results.every((result) => !result.valid));
  assert.equal(fixture.comparisons(), 5);
  assert.equal(fixture.user.failedLoginAttempts, 5);
  assert.equal(results.filter((result) => result.newlyLocked).length, 1);
});

test('a correct password queued after lockout cannot clear it', async () => {
  const fixture = loginFixture({ failedLoginAttempts: 4, lastFailedAt: new Date() });
  const [, correct] = await Promise.all([
    fixture.verifyLoginPassword(fixture.user.id, 'wrong'),
    fixture.verifyLoginPassword(fixture.user.id, 'correct'),
  ]);
  assert.equal(correct.valid, false);
  assert.equal(fixture.comparisons(), 1);
  assert.equal(fixture.user.failedLoginAttempts, 5);
  assert.ok(fixture.user.lockedUntil > new Date());
});

test('successful verification resets failures and expired windows start at one', async () => {
  const fixture = loginFixture({ failedLoginAttempts: 3, lastFailedAt: new Date() });
  assert.equal((await fixture.verifyLoginPassword(fixture.user.id, 'correct')).valid, true);
  assert.equal(fixture.user.failedLoginAttempts, 0);
  assert.equal(fixture.user.lastFailedAt, null);
  assert.equal(fixture.user.lockedUntil, null);
  fixture.user.failedLoginAttempts = 4;
  fixture.user.lastFailedAt = new Date(Date.now() - 6 * 60 * 1000);
  fixture.user.lockedUntil = new Date(Date.now() - 1000);
  assert.equal((await fixture.verifyLoginPassword(fixture.user.id, 'wrong')).attempts, 1);
  assert.equal(fixture.user.lockedUntil, null);
});

test('invalid lockout configuration retains protective defaults', async () => {
  const fixture = loginFixture({}, { LOCKOUT_MAX_ATTEMPTS: 'NaN', LOCKOUT_WINDOW_MINUTES: '-1', LOCKOUT_DURATION_MINUTES: '0' });
  for (let i = 0; i < 5; i++) await fixture.verifyLoginPassword(fixture.user.id, 'wrong');
  assert.equal(fixture.user.failedLoginAttempts, 5);
  assert.ok(fixture.user.lockedUntil.getTime() >= Date.now() + 14 * 60 * 1000);
});

test('sign-in still issues MFA for an enabled clinic without returning encryption keys', async () => {
  const fixture = loginFixture();
  let issued = 0;
  const { POST } = load('app/api/auth/sign-in/route.js', ['POST'], {
    ...fixture, getRequestMeta: () => ({ ip: '192.0.2.1' }),
    parseJsonBody: async () => ({ body: { email: fixture.user.email, password: 'correct' } }),
    sanitizeEmail: (value) => value, secret: (value) => value, bool: (value) => value === true,
    checkRateLimit: async () => ({ allowed: true }), logAudit: () => {}, after: () => {},
    issueOtp: async ({ expectedPasswordHash }) => { assert.equal(expectedPasswordHash, fixture.user.password); issued++; return { pendingToken: 'fixture-token', code: '123456' }; },
    sendMfaOtpEmail: async () => {},
  });
  const response = await POST({});
  assert.equal(response.status, 200);
  assert.equal(response.body.mfaPending, true);
  assert.equal(response.body.wrappedKey, undefined);
  assert.equal(issued, 1);
});

function passwordChangeFixture({ ipAllowed = true, authenticated = true, validPassword = false } = {}) {
  const user = userFixture();
  const session = { userId: user.id, sessionToken: 'first-session' };
  const budgets = new Map();
  let ip = '192.0.2.1';
  let comparisons = 0;
  let revoked = 0;
  let cleared = 0;
  let updated;
  const { POST } = load('app/api/auth/change-password/route.js', ['POST'], {
    getSession: async () => authenticated ? session : null,
    getRequestMeta: () => ({ ip }),
    checkRateLimit: async (key, maximum, seconds) => {
      assert.equal(seconds, 15 * 60);
      if (key.startsWith('change-password:ip:') && !ipAllowed) return { allowed: false };
      const count = (budgets.get(key) ?? 0) + 1;
      budgets.set(key, count);
      return { allowed: count <= maximum };
    },
    parseJsonBody: async () => ({ body: { currentPassword: 'current', newPassword: 'NewFixturePassword123!', wrappedKey: 'new-wrap', keySalt: 'new-salt' } }),
    secret: (value) => value,
    prisma: {
      user: { findUnique: async () => user }, clinic: { findUnique: async () => null },
      $transaction: async (callback) => callback({ user: { update: async ({ data }) => { updated = data; } } }),
    },
    bcrypt: { compare: async (password) => { comparisons++; return validPassword && password === 'current'; }, hash: async () => 'new-hash' },
    revokeUserSessions: async (id) => { assert.equal(id, user.id); revoked++; },
    clearSession: async () => { cleared++; }, sendPasswordChangedEmail: async () => {},
  });
  return {
    POST, session, budgets, setIp: (value) => { ip = value; },
    stats: () => ({ comparisons, revoked, cleared, updated }),
  };
}

test('password guesses stop after five requests across session and IP changes', async () => {
  const fixture = passwordChangeFixture();
  for (let i = 0; i < 12; i++) {
    fixture.setIp(`192.0.2.${i + 1}`);
    fixture.session.sessionToken = `session-${i}`;
    assert.equal((await fixture.POST({})).status, i < 5 ? 400 : 429);
  }
  assert.equal(fixture.stats().comparisons, 5);
  assert.equal(fixture.stats().revoked, 0);
});

test('IP-throttled and unauthenticated password changes never compare passwords', async () => {
  const throttled = passwordChangeFixture({ ipAllowed: false });
  assert.equal((await throttled.POST({})).status, 429);
  assert.equal(throttled.stats().comparisons, 0);
  const anonymous = passwordChangeFixture({ authenticated: false });
  assert.equal((await anonymous.POST({})).status, 401);
  assert.equal(anonymous.budgets.size, 0);
});

test('a permitted password change updates keys and revokes sessions', async () => {
  const fixture = passwordChangeFixture({ validPassword: true });
  assert.equal((await fixture.POST({})).status, 200);
  const stats = fixture.stats();
  assert.equal(stats.updated.password, 'new-hash');
  assert.equal(stats.updated.wrappedKey, 'new-wrap');
  assert.equal(stats.updated.keySalt, 'new-salt');
  assert.equal(stats.revoked, 1);
  assert.equal(stats.cleared, 1);
});

function stepUpFixture({ authenticated = true, validPassword = false } = {}) {
  const session = { userId: 'fixture-user', sessionToken: 'first-session' };
  let ip = '192.0.2.1';
  let now = Date.now();
  let reads = 0;
  let comparisons = 0;
  let consumed = 0;
  let queue = Promise.resolve();
  const grants = [];
  const windows = [];
  const rateLimit = {
    deleteMany: async ({ where }) => {
      for (let i = windows.length - 1; i >= 0; i--) {
        if (windows[i].key === where.key && windows[i].windowEnd <= where.windowEnd.lte) windows.splice(i, 1);
      }
    },
    findMany: async ({ where }) => windows.filter((row) => row.key === where.key && row.windowEnd > where.windowEnd.gt),
    update: async ({ where, data }) => { windows.find((row) => row.id === where.id).count += data.count.increment; },
    create: async ({ data }) => { windows.push({ ...data, id: windows.length + 1 }); },
  };
  const { checkRateLimit } = load('lib/rateLimit.js', ['checkRateLimit'], {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } },
    prisma: {
      $transaction: (callback) => {
        const pending = queue.then(() => callback({ rateLimit, $executeRaw: async () => {} }));
        queue = pending.catch(() => {});
        return pending;
      },
    },
  });
  const { POST } = load('app/api/auth/step-up/route.js', ['POST'], {
    getSession: async () => authenticated ? { ...session } : null,
    getRequestMeta: () => ({ ip }), checkRateLimit,
    parseJsonBody: async (body) => ({ body }), secret: (value) => value, hexToken: (value) => value,
    prisma: { user: { findUnique: async () => { reads++; return { password: 'fixture-hash' }; } } },
    bcrypt: { compare: async () => { comparisons++; return validPassword; } },
    consumeOtp: async ({ purpose, scope, userId }) => {
      assert.equal(purpose, 'step-up');
      assert.equal(scope, session.sessionToken);
      assert.equal(userId, session.userId);
      consumed++;
      return {};
    },
    grantStepUp: async (mode = 'password') => { grants.push(mode); return true; }, logAudit: () => {},
  });
  return {
    POST, session, setIp: (value) => { ip = value; }, advance: (ms) => { now += ms; },
    stats: () => ({ reads, comparisons, consumed, grants, windows }),
  };
}

test('password step-up stops at five guesses despite IP and session rotation', async () => {
  const fixture = stepUpFixture();
  for (let i = 0; i < 12; i++) {
    fixture.setIp(`192.0.2.${i + 1}`);
    fixture.session.sessionToken = `session-${i}`;
    assert.equal((await fixture.POST({ password: 'wrong' })).status, i < 5 ? 401 : 429);
  }
  assert.equal(fixture.stats().reads, 5);
  assert.equal(fixture.stats().comparisons, 5);
  assert.equal(fixture.stats().grants.length, 0);
});

test('parallel password step-up guesses share the account budget', async () => {
  const fixture = stepUpFixture();
  const responses = await Promise.all(Array.from({ length: 20 }, () => fixture.POST({ password: 'wrong' })));
  assert.equal(responses.filter((response) => response.status === 401).length, 5);
  assert.equal(responses.filter((response) => response.status === 429).length, 15);
  assert.equal(fixture.stats().comparisons, 5);
  assert.equal(fixture.stats().grants.length, 0);
});

test('password step-up accounts have separate budgets and still share the IP limit', async () => {
  const fixture = stepUpFixture();
  for (let i = 0; i < 10; i++) {
    fixture.session.userId = `user-${i}`;
    assert.equal((await fixture.POST({ password: 'wrong' })).status, 401);
  }
  fixture.session.userId = 'another-user';
  assert.equal((await fixture.POST({ password: 'wrong' })).status, 429);
  assert.equal(fixture.stats().reads, 10);
  assert.equal(fixture.stats().comparisons, 10);
  assert.equal(fixture.stats().grants.length, 0);
});

test('password step-up budgets expire after fifteen minutes', async () => {
  const fixture = stepUpFixture();
  for (let i = 0; i < 5; i++) await fixture.POST({ password: 'wrong' });
  fixture.advance(15 * 60 * 1000 - 1);
  assert.equal((await fixture.POST({ password: 'wrong' })).status, 429);
  fixture.advance(1);
  assert.equal((await fixture.POST({ password: 'wrong' })).status, 401);
  assert.equal(fixture.stats().comparisons, 6);
});

test('unauthenticated step-up does not read passwords, spend budgets, or grant access', async () => {
  const fixture = stepUpFixture({ authenticated: false });
  assert.equal((await fixture.POST({ password: 'wrong' })).status, 401);
  assert.equal(fixture.stats().reads, 0);
  assert.equal(fixture.stats().comparisons, 0);
  assert.equal(fixture.stats().windows.length, 0);
  assert.equal(fixture.stats().grants.length, 0);
});

test('a valid password grants step-up only while the account budget permits', async () => {
  const fixture = stepUpFixture({ validPassword: true });
  for (let i = 0; i < 5; i++) assert.equal((await fixture.POST({ password: 'correct' })).body.ok, true);
  assert.equal((await fixture.POST({ password: 'correct' })).status, 429);
  assert.deepEqual(fixture.stats().grants, Array(5).fill('password'));
  assert.equal(fixture.stats().comparisons, 5);
});

test('an exhausted password budget does not block the separate OTP grant', async () => {
  const fixture = stepUpFixture();
  for (let i = 0; i < 5; i++) await fixture.POST({ password: 'wrong' });
  assert.equal((await fixture.POST({ pendingToken: 'fixture-token', code: '123456' })).body.ok, true);
  assert.equal(fixture.stats().comparisons, 5);
  assert.equal(fixture.stats().consumed, 1);
  assert.deepEqual(fixture.stats().grants, ['otp']);
});

const { isStepUpValid } = load('lib/auth.js', ['isStepUpValid'], { cache: (fn) => fn });
const recordRoutes = [
  ['app/api/records/[patientId]/route.js', 'POST'],
  ['app/api/records/[patientId]/recipients/route.js', 'GET'],
  ['app/api/records/[patientId]/[recordId]/reshare/route.js', 'POST'],
  ['app/api/records/[patientId]/[recordId]/history/route.js', 'GET'],
  ['app/api/records/[patientId]/[recordId]/attachments/route.js', 'POST'],
  ['app/api/records/[patientId]/[recordId]/attachments/[attachmentId]/route.js', 'DELETE'],
];

for (const [route, method] of recordRoutes) {
  test(`${method} ${route} rejects invalid grants before data or storage access`, async () => {
    const noAccess = () => { assert.fail('An invalid grant must not reach record or storage operations'); };
    for (const session of [
      null,
      { userId: 'fixture-user' },
      { userId: 'fixture-user', stepUpMode: 'password', stepUpGrantedAt: Date.now() },
      { userId: 'fixture-user', stepUpMode: 'otp', stepUpGrantedAt: Date.now() - 16 * 60 * 1000 },
      { userId: 'fixture-user', stepUpMode: 'otp', stepUpGrantedAt: Date.now() + 60 * 1000 },
    ]) {
      const handler = load(route, [method], {
        getSession: async () => session, isStepUpValid,
        getAuthContext: noAccess, getRecordsDentist: noAccess,
        prisma: new Proxy({}, { get: noAccess }), removeStorageObjects: noAccess,
      });
      const response = await handler[method]({}, { params: Promise.resolve({}) });
      assert.equal(response.status, session ? 403 : 401);
      if (session) assert.equal(response.body.requiresStepUp, true);
    }
  });
}

test('attachment deletion permits a current OTP grant and retains references on storage failure', async () => {
  const route = 'app/api/records/[patientId]/[recordId]/attachments/[attachmentId]/route.js';
  for (const storageFails of [false, true]) {
    let removed = 0;
    let marked = 0;
    const { DELETE } = load(route, ['DELETE'], {
      getSession: async () => ({ userId: 'fixture-user', stepUpMode: 'otp', stepUpGrantedAt: Date.now() }), isStepUpValid,
      getRecordsDentist: async () => ({ dentistId: 'fixture-dentist', clinicId: 'fixture-clinic' }),
      dentistTreatsPatient: async () => true,
      prisma: {
        patientRecord: { findFirst: async () => ({ id: 'record' }) },
        attachment: { findFirst: async () => ({ id: 'attachment', fileUrl: 'fixture/path.pdf' }), update: async () => { marked++; } },
      },
      removeStorageObjects: async (bucket, paths) => {
        assert.equal(bucket, 'record-attachments');
        assert.equal(paths[0], 'fixture/path.pdf');
        if (storageFails) throw new Error('Storage unavailable');
        removed++;
      },
    });
    const response = await DELETE({}, { params: Promise.resolve({ patientId: 'patient', recordId: 'record', attachmentId: 'attachment' }) });
    assert.equal(response.status, storageFails ? 502 : 200);
    assert.equal(removed, storageFails ? 0 : 1);
    assert.equal(marked, storageFails ? 0 : 1);
  }
});
