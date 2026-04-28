/**
 * prisma/make-superadmin.js
 *
 * Promotes intellident.inc@gmail.com to SUPERADMIN (role 0).
 * If the user does not exist, creates them with a temporary password.
 * If the user exists, updates their role and clears their clinicId.
 *
 * Run: node prisma/make-superadmin.js
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

const SUPERADMIN_ROLE = 0
const EMAIL = 'intellident.inc@gmail.com'
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
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
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
    const hashedPassword = await bcrypt.hash(PASSWORD, 12)
    const { wrappedKey, keySalt } = await generateKeyMaterial(PASSWORD)

    await prisma.user.update({
      where: { email: EMAIL },
      data: {
        role: SUPERADMIN_ROLE,
        clinicId: null,
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        wrappedKey,
        keySalt,
      },
    })

    console.log('─────────────────────────────────────')
    console.log('Super admin updated!')
    console.log(`  Email   : ${EMAIL}`)
    console.log(`  Password: ${PASSWORD}`)
    console.log('─────────────────────────────────────')
  } else {
    const hashedPassword = await bcrypt.hash(PASSWORD, 12)
    const { wrappedKey, keySalt } = await generateKeyMaterial(PASSWORD)

    await prisma.user.create({
      data: {
        email: EMAIL,
        firstName: 'IntelliDent',
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
}

main().catch(console.error).finally(() => prisma.$disconnect())
