import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseJsonBody, secret } from '@/lib/validate'

/**
 * POST /api/profile/keys — provision the caller's envelope keypair (set-if-null).
 *
 * Stores the public key (plaintext) and the private key encrypted under the user's
 * master key. The server never sees the master key or the unwrapped private key.
 * Set-if-null: once a keypair exists it is not overwritten (prevents a transient
 * client from clobbering a working keypair and losing record access). A password
 * reset clears these fields server-side so a fresh keypair can be provisioned here.
 */
export async function POST(request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJsonBody(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const publicKey = secret(parsed.body.publicKey, 4096)
  const encryptedPrivateKey = secret(parsed.body.encryptedPrivateKey, 8192)
  const privateKeyIv = secret(parsed.body.privateKeyIv, 256)
  if (!publicKey || !encryptedPrivateKey || !privateKeyIv) {
    return NextResponse.json({ error: 'publicKey, encryptedPrivateKey, and privateKeyIv are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { publicKey: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Set-if-null — do not overwrite an existing keypair.
  if (user.publicKey) return NextResponse.json({ ok: true, alreadyProvisioned: true })

  await prisma.user.update({
    where: { id: session.userId },
    data: { publicKey, encryptedPrivateKey, privateKeyIv },
  })
  return NextResponse.json({ ok: true })
}
