import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155',
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    objectFit: 'cover',
  },
  clinicName: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 2,
  },
  clinicSub: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 12,
  },
  receiptTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
    marginBottom: 4,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    width: 130,
    color: '#64748b',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    flex: 1,
    color: '#334155',
    fontSize: 10,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowLast: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  tableLabel: {
    flex: 1,
    color: '#475569',
    fontSize: 10,
  },
  tableValue: {
    width: 100,
    textAlign: 'right',
    color: '#334155',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderTopWidth: 1.5,
    borderTopColor: '#cbd5e1',
    marginTop: 4,
  },
  totalLabel: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#0f172a',
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#15803d',
  },
  balanceRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  balanceLabel: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 9,
  },
  balanceValue: {
    width: 100,
    textAlign: 'right',
    fontSize: 9,
    color: '#94a3b8',
  },
  footer: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  thankYou: {
    fontSize: 10,
    color: '#2563eb',
    fontFamily: 'Helvetica-Bold',
  },
})

function php(n) {
  return '₱' + Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingReceiptDocument({ billing, clinic }) {
  const reservationPayments = (billing.payments ?? []).filter(p => p.type === 'RESERVATION')
  const otherPayments       = (billing.payments ?? []).filter(p => p.type !== 'RESERVATION')
  const reservationTotal    = reservationPayments.reduce((s, p) => s + p.amount, 0)
  const otherTotal          = otherPayments.reduce((s, p) => s + p.amount, 0)

  const patient     = billing.patient
  const appointment = billing.appointment
  const serviceName = appointment?.service?.name ?? 'Dental Service'

  return (
    <Document>
      <Page size='A5' style={styles.page}>

        {/* Clinic Header */}
        <View style={styles.header}>
          {clinic?.logoUrl && <Image src={clinic.logoUrl} style={styles.logo} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.clinicName}>{clinic?.name ?? 'Dental Clinic'}</Text>
            {clinic?.address && <Text style={styles.clinicSub}>{clinic.address}</Text>}
            {clinic?.email   && <Text style={styles.clinicSub}>{clinic.email}</Text>}
            {clinic?.phone   && <Text style={styles.clinicSub}>{clinic.phone}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Receipt Title */}
        <Text style={styles.receiptTitle}>OFFICIAL RECEIPT</Text>

        {/* Receipt Meta */}
        <View style={{ marginTop: 8 }}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Receipt No.</Text>
            <Text style={styles.metaValue}>{billing.receiptNumber ?? 'PENDING'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date Issued</Text>
            <Text style={styles.metaValue}>{formatDate(billing.updatedAt ?? billing.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Patient & Appointment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Patient Name</Text>
            <Text style={styles.metaValue}>{patient ? `${patient.firstName} ${patient.lastName}` : '—'}</Text>
          </View>
          {patient?.patientCode && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Patient Code</Text>
              <Text style={styles.metaValue}>{patient.patientCode}</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Appointment Details</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Reference No.</Text>
            <Text style={styles.metaValue}>{appointment?.appointmentCode ?? '—'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Service</Text>
            <Text style={styles.metaValue}>{serviceName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formatDate(appointment?.scheduledAt)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Itemized Amounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>

          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Service Total</Text>
            <Text style={styles.tableValue}>{php(billing.amount)}</Text>
          </View>

          {reservationTotal > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Reservation Fee Paid</Text>
              <Text style={[styles.tableValue, { color: '#15803d' }]}>{php(reservationTotal)}</Text>
            </View>
          )}

          {otherTotal > 0 && (
            <View style={styles.tableRowLast}>
              <Text style={styles.tableLabel}>Additional Payment(s)</Text>
              <Text style={[styles.tableValue, { color: '#15803d' }]}>{php(otherTotal)}</Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL PAID</Text>
            <Text style={styles.totalValue}>{php(billing.amountPaid)}</Text>
          </View>

          {billing.balance > 0 && (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Outstanding Balance</Text>
              <Text style={[styles.balanceValue, { color: '#b91c1c' }]}>{php(billing.balance)}</Text>
            </View>
          )}
        </View>

        {/* Payment Methods */}
        {(billing.payments ?? []).length > 0 && (
          <View style={[styles.section, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            {(billing.payments ?? []).map((p, i) => (
              <View key={i} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{formatDate(p.paidAt)}</Text>
                <Text style={styles.metaValue}>{p.method ?? 'CASH'} — {php(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by IntelliDent</Text>
          <Text style={styles.thankYou}>Thank you for choosing {clinic?.name ?? 'our clinic'}!</Text>
        </View>
      </Page>
    </Document>
  )
}
