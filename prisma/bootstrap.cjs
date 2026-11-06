function bootstrapPassword(admin = false) {
  if (admin) {
    if (process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') throw new Error('Set ALLOW_ADMIN_BOOTSTRAP=true for an explicit administrator bootstrap.');
  } else if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seeding requires a non-production environment and ALLOW_DEMO_SEED=true.');
  }
  const password = process.env[admin ? 'SEED_ADMIN_PASSWORD' : 'SEED_PASSWORD'];
  if (typeof password !== 'string' || password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Provide a unique bootstrap password with at least 12 characters, uppercase, lowercase, number, and symbol.');
  }
  return password;
}

module.exports = { bootstrapPassword };
