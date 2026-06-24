/**
 * Clinic backup import (restore) logic.
 *
 * `importClinicBackup(tx, clinicId, backup)` re-applies a backup JSON snapshot
 * (produced by GET /api/super/clinics/[id]/backup) into the database using
 * idempotent, upsert-by-primary-key writes. It is non-destructive: it inserts
 * missing rows and updates existing ones, but never deletes rows created after
 * the backup.
 *
 * MUST be called inside a Prisma transaction (`tx`) so a partial failure rolls
 * back cleanly.
 *
 * Safety invariants:
 *  - _meta.clinicId must equal the target clinicId (cross-clinic restore blocked).
 *  - A row is only UPDATED if the existing record already belongs to the target
 *    clinic — a backup can never overwrite another clinic's data by reusing its id.
 *  - Every CREATE is re-stamped with clinicId = target, so foreign rows can't be
 *    injected under a borrowed clinicId.
 *  - User email/username uniqueness is checked before create; collisions are
 *    skipped (and their dependent rows cascade-skip via parent-existence checks).
 *  - Audit logs are intentionally NOT imported (append-only trail; the restore
 *    itself is already audit-logged).
 *
 * Returns a per-entity counts summary: { entity: { created, updated, skipped } }.
 */

const toDate = (v) => (v == null ? null : new Date(v))

const bucket = () => ({ created: 0, updated: 0, skipped: 0 })

/**
 * Generic row importer.
 *  - find(row)    -> existing record (with ownership fields) or null
 *  - isOwned(rec) -> true if the existing record belongs to the target scope
 *  - update(row)  -> performs the update
 *  - create(row)  -> performs the create; return false to skip (missing parent / collision)
 */
async function importRows(rows, { find, isOwned, update, create }, b) {
  for (const row of rows) {
    const existing = await find(row)
    if (existing) {
      if (!isOwned(existing)) { b.skipped++; continue }
      await update(row, existing)
      b.updated++
    } else {
      const ok = await create(row)
      if (ok === false) { b.skipped++; continue }
      b.created++
    }
  }
}

export async function importClinicBackup(tx, clinicId, backup) {
  if (!backup || typeof backup !== 'object' || !backup._meta) {
    throw new Error('Invalid backup file')
  }
  if (backup._meta.clinicId !== clinicId) {
    throw new Error('Backup does not belong to this clinic')
  }

  const summary = {
    schemaVersion: backup._meta.schemaVersion ?? 'unknown',
    clinic: { updated: 0 },
    schedule: { updated: 0 },
    closures: bucket(),
    users: bucket(),
    dentists: bucket(),
    receptionists: bucket(),
    patients: bucket(),
    services: bucket(),
    appointments: bucket(),
    appointmentServices: bucket(),
    billing: bucket(),
    payments: bucket(),
  }

  // ---- 1. Users (root of all FK dependencies) ------------------------------
  await importRows(backup.users ?? [], {
    find: (u) => tx.user.findUnique({ where: { id: u.id }, select: { id: true, clinicId: true } }),
    isOwned: (e) => e.clinicId === clinicId,
    update: (u) => tx.user.update({
      where: { id: u.id },
      data: {
        email: u.email, firstName: u.firstName, middleInitial: u.middleInitial, lastName: u.lastName,
        phone: u.phone, address: u.address, dateOfBirth: toDate(u.dateOfBirth), gender: u.gender,
        password: u.password, passwordHistory: u.passwordHistory ?? [], role: u.role,
        wrappedKey: u.wrappedKey, keySalt: u.keySalt, publicKey: u.publicKey,
        encryptedPrivateKey: u.encryptedPrivateKey, privateKeyIv: u.privateKeyIv,
        isActive: u.isActive, username: u.username, mustChangePassword: u.mustChangePassword,
        passwordExpiresAt: toDate(u.passwordExpiresAt), termsAcceptedAt: toDate(u.termsAcceptedAt),
        isDeleted: u.isDeleted,
      },
    }),
    create: async (u) => {
      // email + username are @unique — refuse if a DIFFERENT id already holds them.
      const emailHolder = u.email
        ? await tx.user.findUnique({ where: { email: u.email }, select: { id: true } })
        : null
      if (emailHolder && emailHolder.id !== u.id) return false
      const nameHolder = u.username
        ? await tx.user.findUnique({ where: { username: u.username }, select: { id: true } })
        : null
      if (nameHolder && nameHolder.id !== u.id) return false
      await tx.user.create({
        data: {
          id: u.id, email: u.email, firstName: u.firstName, middleInitial: u.middleInitial,
          lastName: u.lastName, phone: u.phone, address: u.address, dateOfBirth: toDate(u.dateOfBirth),
          gender: u.gender, password: u.password, passwordHistory: u.passwordHistory ?? [], role: u.role,
          wrappedKey: u.wrappedKey, keySalt: u.keySalt, publicKey: u.publicKey,
          encryptedPrivateKey: u.encryptedPrivateKey, privateKeyIv: u.privateKeyIv,
          clinicId, isActive: u.isActive ?? true, username: u.username,
          mustChangePassword: u.mustChangePassword ?? false,
          passwordExpiresAt: toDate(u.passwordExpiresAt), termsAcceptedAt: toDate(u.termsAcceptedAt),
          isDeleted: u.isDeleted ?? false, createdAt: toDate(u.createdAt) ?? undefined,
        },
      })
    },
  }, summary.users)

  // helper: does a user owned by this clinic exist?
  const userExists = async (userId) => {
    if (!userId) return false
    const u = await tx.user.findUnique({ where: { id: userId }, select: { clinicId: true } })
    return !!u && u.clinicId === clinicId
  }

  // ---- 2. Clinic profile ---------------------------------------------------
  const c = backup.clinic
  if (c) {
    await tx.clinic.update({
      where: { id: clinicId },
      data: {
        name: c.name, email: c.email, phone: c.phone, landline: c.landline, address: c.address,
        logoUrl: c.logoUrl, isEnabled: c.isEnabled,
        passwordExpiryEnabled: c.passwordExpiryEnabled, passwordExpiryDays: c.passwordExpiryDays,
        passwordExpiryRoles: c.passwordExpiryRoles ?? undefined,
      },
    })
    summary.clinic.updated = 1

    // ---- 3. Schedule (one per clinic, keyed by clinicId) -------------------
    if (c.schedule) {
      await tx.clinicSchedule.upsert({
        where: { clinicId },
        create: {
          clinicId, workingDays: c.schedule.workingDays ?? [],
          openTime: c.schedule.openTime ?? '08:00', closeTime: c.schedule.closeTime ?? '17:00',
        },
        update: {
          workingDays: c.schedule.workingDays ?? [],
          openTime: c.schedule.openTime ?? '08:00', closeTime: c.schedule.closeTime ?? '17:00',
        },
      })
      summary.schedule.updated = 1
    }

    // ---- 4. Closures ------------------------------------------------------
    await importRows(c.closures ?? [], {
      find: (x) => tx.clinicClosure.findUnique({ where: { id: x.id }, select: { id: true, clinicId: true } }),
      isOwned: (e) => e.clinicId === clinicId,
      update: (x) => tx.clinicClosure.update({
        where: { id: x.id }, data: { date: toDate(x.date), reason: x.reason },
      }),
      create: (x) => tx.clinicClosure.create({
        data: { id: x.id, clinicId, date: toDate(x.date), reason: x.reason, createdAt: toDate(x.createdAt) ?? undefined },
      }),
    }, summary.closures)
  }

  // ---- 5. Staff profiles ---------------------------------------------------
  await importRows(backup.dentists ?? [], {
    find: (d) => tx.dentist.findUnique({ where: { id: d.id }, select: { id: true, clinicId: true } }),
    isOwned: (e) => e.clinicId === clinicId,
    update: (d) => tx.dentist.update({ where: { id: d.id }, data: { specialty: d.specialty, isDeleted: d.isDeleted } }),
    create: async (d) => {
      if (!(await userExists(d.userId))) return false
      await tx.dentist.create({
        data: { id: d.id, userId: d.userId, clinicId, specialty: d.specialty, isDeleted: d.isDeleted ?? false, createdAt: toDate(d.createdAt) ?? undefined },
      })
    },
  }, summary.dentists)

  await importRows(backup.receptionists ?? [], {
    find: (r) => tx.receptionist.findUnique({ where: { id: r.id }, select: { id: true, clinicId: true } }),
    isOwned: (e) => e.clinicId === clinicId,
    update: (r) => tx.receptionist.update({ where: { id: r.id }, data: { isDeleted: r.isDeleted } }),
    create: async (r) => {
      if (!(await userExists(r.userId))) return false
      await tx.receptionist.create({
        data: { id: r.id, userId: r.userId, clinicId, isDeleted: r.isDeleted ?? false, createdAt: toDate(r.createdAt) ?? undefined },
      })
    },
  }, summary.receptionists)

  // ---- 6. Patients ---------------------------------------------------------
  await importRows(backup.patients ?? [], {
    find: (p) => tx.patient.findUnique({ where: { id: p.id }, select: { id: true, clinicId: true } }),
    isOwned: (e) => e.clinicId === clinicId,
    update: (p) => tx.patient.update({
      where: { id: p.id },
      data: {
        patientCode: p.patientCode, firstName: p.firstName, lastName: p.lastName,
        dateOfBirth: toDate(p.dateOfBirth), gender: p.gender, phone: p.phone, address: p.address,
        consentStatus: p.consentStatus, consentGivenAt: toDate(p.consentGivenAt), isDeleted: p.isDeleted,
      },
    }),
    create: async (p) => {
      if (!p.userId || !(await userExists(p.userId))) return false
      if (p.patientCode) {
        const holder = await tx.patient.findUnique({ where: { patientCode: p.patientCode }, select: { id: true } })
        if (holder && holder.id !== p.id) return false
      }
      await tx.patient.create({
        data: {
          id: p.id, userId: p.userId, clinicId, patientCode: p.patientCode,
          firstName: p.firstName, lastName: p.lastName, dateOfBirth: toDate(p.dateOfBirth), gender: p.gender,
          phone: p.phone, address: p.address, consentStatus: p.consentStatus ?? 'PENDING',
          consentGivenAt: toDate(p.consentGivenAt), isDeleted: p.isDeleted ?? false, createdAt: toDate(p.createdAt) ?? undefined,
        },
      })
    },
  }, summary.patients)

  // ---- 7. Services ---------------------------------------------------------
  await importRows(backup.services ?? [], {
    find: (s) => tx.service.findUnique({ where: { id: s.id }, select: { id: true, clinicId: true } }),
    isOwned: (e) => e.clinicId === clinicId,
    update: (s) => tx.service.update({
      where: { id: s.id },
      data: { name: s.name, description: s.description, duration: s.duration, price: s.price, bufferTime: s.bufferTime, isDeleted: s.isDeleted },
    }),
    create: (s) => tx.service.create({
      data: {
        id: s.id, clinicId, name: s.name, description: s.description, duration: s.duration,
        price: s.price, bufferTime: s.bufferTime ?? 0, isDeleted: s.isDeleted ?? false, createdAt: toDate(s.createdAt) ?? undefined,
      },
    }),
  }, summary.services)

  // existence helpers scoped to this clinic
  const ownedExists = async (model, id) => {
    if (!id) return false
    const r = await tx[model].findUnique({ where: { id }, select: { clinicId: true } })
    return !!r && r.clinicId === clinicId
  }

  // ---- 8. Appointments -----------------------------------------------------
  await importRows(backup.appointments ?? [], {
    find: (a) => tx.appointment.findUnique({ where: { id: a.id }, select: { id: true, clinicId: true } }),
    isOwned: (e) => e.clinicId === clinicId,
    update: async (a) => {
      const dentistId = (await ownedExists('dentist', a.dentistId)) ? a.dentistId : undefined
      const serviceId = (await ownedExists('service', a.serviceId)) ? a.serviceId : undefined
      await tx.appointment.update({
        where: { id: a.id },
        data: {
          scheduledAt: toDate(a.scheduledAt), endsAt: toDate(a.endsAt), status: a.status, notes: a.notes,
          aiSuggested: a.aiSuggested, reminderSent24h: a.reminderSent24h, reminderSent2h: a.reminderSent2h,
          isDeleted: a.isDeleted, ...(dentistId !== undefined && { dentistId }), ...(serviceId !== undefined && { serviceId }),
        },
      })
    },
    create: async (a) => {
      if (!a.patientId || !(await ownedExists('patient', a.patientId))) return false // v1.0 / orphan
      if (a.appointmentCode) {
        const holder = await tx.appointment.findUnique({ where: { appointmentCode: a.appointmentCode }, select: { id: true } })
        if (holder && holder.id !== a.id) return false
      }
      const dentistId = (await ownedExists('dentist', a.dentistId)) ? a.dentistId : null
      const serviceId = (await ownedExists('service', a.serviceId)) ? a.serviceId : null
      await tx.appointment.create({
        data: {
          id: a.id, clinicId, patientId: a.patientId, dentistId, serviceId,
          appointmentCode: a.appointmentCode, scheduledAt: toDate(a.scheduledAt), endsAt: toDate(a.endsAt),
          status: a.status ?? 'PENDING', notes: a.notes, aiSuggested: a.aiSuggested ?? false,
          reminderSent24h: a.reminderSent24h ?? false, reminderSent2h: a.reminderSent2h ?? false,
          isDeleted: a.isDeleted ?? false, createdAt: toDate(a.createdAt) ?? undefined,
        },
      })
    },
  }, summary.appointments)

  // ---- 9. Appointment ⇄ Service join (multi-service) ----------------------
  for (const a of backup.appointments ?? []) {
    if (!(await ownedExists('appointment', a.id))) continue
    for (const link of a.services ?? []) {
      if (!(await ownedExists('service', link.serviceId))) { summary.appointmentServices.skipped++; continue }
      const existing = await tx.appointmentService.findUnique({
        where: { appointmentId_serviceId: { appointmentId: a.id, serviceId: link.serviceId } },
        select: { appointmentId: true },
      })
      await tx.appointmentService.upsert({
        where: { appointmentId_serviceId: { appointmentId: a.id, serviceId: link.serviceId } },
        create: { appointmentId: a.id, serviceId: link.serviceId, order: link.order ?? 0 },
        update: { order: link.order ?? 0 },
      })
      if (existing) summary.appointmentServices.updated++
      else summary.appointmentServices.created++
    }
  }

  // ---- 10. Billing ---------------------------------------------------------
  await importRows(backup.billing ?? [], {
    find: (b) => tx.billing.findUnique({ where: { id: b.id }, select: { id: true, clinicId: true } }),
    isOwned: (e) => e.clinicId === clinicId,
    update: (b) => tx.billing.update({
      where: { id: b.id },
      data: {
        amount: b.amount, amountPaid: b.amountPaid, balance: b.balance, status: b.status,
        receiptNumber: b.receiptNumber, isDeleted: b.isDeleted,
      },
    }),
    create: async (b) => {
      if (!b.patientId || !b.appointmentId || !b.billingType) return false // v1.0 / incomplete
      if (!(await ownedExists('patient', b.patientId))) return false
      if (!(await ownedExists('appointment', b.appointmentId))) return false
      if (b.receiptNumber) {
        const rh = await tx.billing.findUnique({ where: { receiptNumber: b.receiptNumber }, select: { id: true } })
        if (rh && rh.id !== b.id) return false
      }
      // @@unique([appointmentId, billingType])
      const dup = await tx.billing.findFirst({
        where: { appointmentId: b.appointmentId, billingType: b.billingType, NOT: { id: b.id } },
        select: { id: true },
      })
      if (dup) return false
      await tx.billing.create({
        data: {
          id: b.id, clinicId, patientId: b.patientId, appointmentId: b.appointmentId, billingType: b.billingType,
          amount: b.amount, amountPaid: b.amountPaid ?? 0, balance: b.balance,
          status: b.status ?? 'UNPAID', receiptNumber: b.receiptNumber, isDeleted: b.isDeleted ?? false,
          createdAt: toDate(b.createdAt) ?? undefined,
        },
      })
    },
  }, summary.billing)

  // ---- 11. Payments (billingId taken from the parent billing row) ---------
  for (const b of backup.billing ?? []) {
    const billingOwned = await ownedExists('billing', b.id)
    for (const pay of b.payments ?? []) {
      if (!billingOwned) { summary.payments.skipped++; continue }
      const existing = await tx.payment.findUnique({ where: { id: pay.id }, select: { id: true, billingId: true } })
      if (existing) {
        if (existing.billingId !== b.id) { summary.payments.skipped++; continue }
        await tx.payment.update({
          where: { id: pay.id },
          data: {
            amount: pay.amount, method: pay.method, notes: pay.notes, type: pay.type ?? 'FULL',
            paymongoCheckoutSessionId: pay.paymongoCheckoutSessionId, paymongoPaymentId: pay.paymongoPaymentId,
            paidAt: toDate(pay.paidAt) ?? undefined, isDeleted: pay.isDeleted,
          },
        })
        summary.payments.updated++
      } else {
        await tx.payment.create({
          data: {
            id: pay.id, billingId: b.id, amount: pay.amount, method: pay.method, notes: pay.notes,
            type: pay.type ?? 'FULL', paymongoCheckoutSessionId: pay.paymongoCheckoutSessionId,
            paymongoPaymentId: pay.paymongoPaymentId, paidAt: toDate(pay.paidAt) ?? undefined,
            isDeleted: pay.isDeleted ?? false, createdAt: toDate(pay.createdAt) ?? undefined,
          },
        })
        summary.payments.created++
      }
    }
  }

  return summary
}
