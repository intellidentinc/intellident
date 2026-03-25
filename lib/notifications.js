import { prisma } from '@/lib/prisma'

/**
 * Create a single in-app notification for one user.
 */
export async function createNotification({ userId, clinicId, type, title, body, appointmentId }) {
  return prisma.inAppNotification.create({
    data: { userId, clinicId, type, title, body, appointmentId: appointmentId ?? null },
  })
}

/**
 * Notify all RECEPTIONIST and ADMIN users in a clinic.
 */
export async function notifyStaff({ clinicId, type, title, body, appointmentId }) {
  const staff = await prisma.user.findMany({
    where: { clinicId, role: { in: ['RECEPTIONIST', 'ADMIN'] }, isDeleted: false },
    select: { id: true },
  })
  if (!staff.length) return
  await prisma.inAppNotification.createMany({
    data: staff.map((u) => ({ userId: u.id, clinicId, type, title, body, appointmentId: appointmentId ?? null })),
  })
}
