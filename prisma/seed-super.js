/**
 * prisma/seed-super.js
 *
 * Creates the super admin user (role 0) with no clinic affiliation.
 * Run once: node prisma/seed-super.js
 *
 * Credentials:
 *   Email:    superadmin@intellident.app
 *   Password: Intellident2026#
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

const SUPERADMIN_ROLE = 0
const EMAIL = 'superadmin@intellident.app'
const PASSWORD = '12345678'

const enc = new TextEncoder()

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

async function generateKeyMaterial(password) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  const kek = await globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey']
  )
  const masterKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
  const wrapped = await globalThis.crypto.subtle.wrapKey('raw', masterKey, kek, 'AES-KW')
  return { wrappedKey: toBase64(wrapped), keySalt: toBase64(salt) }
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (existing) {
    console.log(`Super admin already exists (${EMAIL}) — skipping.`)
    return
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 12)
  const { wrappedKey, keySalt } = await generateKeyMaterial(PASSWORD)

  await prisma.user.create({
    data: {
      email: EMAIL,
      firstName: 'Super',
      lastName: 'Admin',
      password: hashedPassword,
      passwordHistory: [hashedPassword],
      role: SUPERADMIN_ROLE,
      clinicId: null,
      wrappedKey,
      keySalt,
    },
  })

  console.log('─────────────────────────────────────')
  console.log('Super admin created!')
  console.log(`  Email   : ${EMAIL}`)
  console.log(`  Password: ${PASSWORD}`)
  console.log('─────────────────────────────────────')
}

main().catch(console.error).finally(() => prisma.$disconnect())
