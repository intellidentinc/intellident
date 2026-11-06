import { prisma } from '@/lib/prisma';
import { computeBillingStatus, generateReceiptNumber } from '@/lib/billing';

export async function recordPayment({ billingId, clinicId, amount, method, notes = null, type = 'FULL', paymongoPaymentId = null, paymongoCheckoutSessionId = null }) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001) {
    return { error: 'Payment must be a positive amount in whole centavos', status: 400 };
  }
  return prisma.$transaction(async (transaction) => {
    if (paymongoPaymentId) {
      const lockKey = 'payment:' + paymongoPaymentId;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(md5(${lockKey}), 1, 16))::bit(64)::bigint)`;
      const existing = await transaction.payment.findFirst({ where: { paymongoPaymentId } });
      if (existing) return { duplicate: true };
    }
    await transaction.$queryRaw`SELECT id FROM billings WHERE id = ${billingId} FOR UPDATE`;
    const billing = await transaction.billing.findFirst({
      where: { id: billingId, clinicId, isDeleted: false },
      include: { patient: { include: { user: { select: { id: true, firstName: true } } } } },
    });
    if (!billing) return { error: 'Billing not found', status: 404 };
    if (billing.status === 'REFUNDED' || (!paymongoPaymentId && (billing.status === 'PAID' || amount > billing.balance + 0.001))) {
      return { error: 'Payment exceeds the outstanding balance or billing is settled', status: 409 };
    }
    await transaction.payment.create({
      data: { billingId, amount, method, notes, type, paymongoPaymentId, paymongoCheckoutSessionId },
    });
    const amountPaid = Math.round((billing.amountPaid + amount) * 100) / 100;
    const balance = Math.max(0, Math.round((billing.amount - amountPaid) * 100) / 100);
    const status = computeBillingStatus(amountPaid, billing.amount);
    const receiptNumber = billing.receiptNumber || (status === 'PAID' ? await generateReceiptNumber(billing.clinicId, transaction) : undefined);
    const updated = await transaction.billing.update({ where: { id: billingId }, data: { amountPaid, balance, status, receiptNumber } });
    return { billing: { ...billing, ...updated } };
  });
}
