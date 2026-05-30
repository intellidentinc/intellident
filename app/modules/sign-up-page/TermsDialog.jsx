'use client';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { X } from 'lucide-react';

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} color="primary" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</Box>
    </Box>
  );
}

function Para({ children }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
      {children}
    </Typography>
  );
}

function BulletList({ items }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 3 }}>
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function TermsDialog({ open, onClose, initialTab = 'terms' }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper"
      PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Terms of Service &amp; Data Privacy Policy</Typography>
          <Typography variant="caption" color="text.secondary">
            IntelliDent — Effective: January 1, 2026
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 3, px: { xs: 3, sm: 4 } }}>

        {/* Intro */}
        <Para>
          Welcome to <strong>IntelliDent</strong>, an AI-powered dental scheduling and patient record system
          operated for partner dental clinics in the Philippines. By creating an account, you agree to the
          following Terms of Service and consent to the collection and processing of your personal and health
          data in accordance with applicable Philippine law and international security standards.
        </Para>

        <Box sx={{ mt: 3 }} />

        {/* ──────── TERMS OF SERVICE ──────── */}
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: 'text.primary' }}>
          Part I — Terms of Service
        </Typography>

        <Section title="1. Acceptance of Terms">
          <Para>
            By registering an account on IntelliDent, you acknowledge that you have read, understood, and
            agree to be bound by these Terms of Service and our Data Privacy Policy. If you do not agree,
            you must not create an account or use this system.
          </Para>
        </Section>

        <Section title="2. Account Eligibility">
          <Para>
            You must be at least 18 years old to create an account independently. Minors may only be
            registered as patients by a parent or legal guardian who accepts these terms on their behalf.
            You are responsible for maintaining the confidentiality of your credentials.
          </Para>
        </Section>

        <Section title="3. Permitted Use">
          <Para>You may use IntelliDent solely for lawful purposes, including:</Para>
          <BulletList items={[
            'Booking and managing dental appointments at partner clinics',
            'Viewing your dental records and billing history',
            'Communicating with clinic staff through the system',
            'Managing your personal and contact information',
          ]} />
          <Para>
            You must not use the system to misrepresent your identity, tamper with records, interfere with
            other users' data, or conduct any unauthorized security testing against the platform.
          </Para>
        </Section>

        <Section title="4. Account Security">
          <Para>
            You are responsible for all activity under your account. You must use a strong password (minimum
            8 characters with uppercase, lowercase, number, and special character), enable email-based
            multi-factor authentication as prompted, and log out from shared devices. Your session will
            automatically expire after <strong>30 minutes of inactivity</strong>.
          </Para>
        </Section>

        <Section title="5. Termination">
          <Para>
            IntelliDent reserves the right to suspend or deactivate your account if you violate these Terms,
            provide false information during registration, or engage in conduct that is harmful to other users
            or the system. You may request account deletion at any time by contacting your clinic's
            administrator.
          </Para>
        </Section>

        <Section title="6. Limitation of Liability">
          <Para>
            IntelliDent is a scheduling and record-keeping tool. It does not provide medical advice or replace
            professional dental consultation. IntelliDent is not liable for treatment outcomes, missed
            appointments, or reliance on AI-generated suggestions without professional review.
          </Para>
        </Section>

        <Box sx={{ my: 3 }}>
          <Divider />
        </Box>

        {/* ──────── DATA PRIVACY POLICY ──────── */}
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: 'text.primary' }}>
          Part II — Data Privacy Policy
        </Typography>

        <Para>
          This policy governs how IntelliDent collects, uses, stores, and protects your personal data in
          compliance with the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong>,
          its Implementing Rules and Regulations, and relevant internationally recognized security frameworks.
        </Para>

        <Box sx={{ mt: 2 }} />

        <Section title="1. Data Controller">
          <Para>
            Each partner dental clinic (Maria Laura Cruz Dental Clinic, KH Dental Aesthetics, and Cabasal
            Dental Clinic) acts as the Personal Information Controller (PIC) for patient data held under their
            clinic account. IntelliDent acts as the Personal Information Processor (PIP) on their behalf.
          </Para>
        </Section>

        <Section title="2. Data We Collect">
          <Para>We collect the following categories of personal information:</Para>
          <BulletList items={[
            'Identity data: first name, middle initial, last name, date of birth',
            'Contact data: email address, mobile number, home address',
            'Authentication data: hashed password, encrypted master key, session tokens',
            'Health data (sensitive personal information): dental records, diagnoses, treatment notes, visit history',
            'Financial data: billing records, payment status, PayMongo transaction references',
            'Usage data: audit logs, IP address, browser/device user-agent for security purposes',
          ]} />
        </Section>

        <Section title="3. Legal Basis and Purpose of Processing">
          <Para>
            We process your personal data under the following lawful bases as defined in Section 12 of
            RA 10173:
          </Para>
          <BulletList items={[
            'Consent — you explicitly agree to these terms at the time of registration',
            'Contract — to fulfill the appointment scheduling and billing services you requested',
            'Legal obligation — to maintain health records as required by Philippine law',
            'Legitimate interests — to detect fraud, maintain system security, and improve service quality',
          ]} />
          <Para>Specifically, we use your data to:</Para>
          <BulletList items={[
            'Create and manage your patient profile and appointment history',
            'Send appointment confirmations, reminders, and status notifications via email',
            'Process payments through PayMongo for dental services',
            'Enable dentists to create, view, and update encrypted dental records',
            'Generate audit logs to ensure accountability and detect unauthorized access',
            'Provide AI-assisted slot recommendations and clinic support chatbot responses',
          ]} />
        </Section>

        <Section title="4. End-to-End Encryption of Health Data">
          <Para>
            All dental records and clinical notes are protected with <strong>End-to-End Encryption (E2EE)</strong>{' '}
            using AES-GCM-256 with keys derived via PBKDF2. Your master encryption key is wrapped using a
            Key Encryption Key derived from your password — the IntelliDent servers <strong>never have access
            to your plaintext health records</strong>. Records are accompanied by SHA-256 content hashes to
            detect any unauthorized tampering.
          </Para>
        </Section>

        <Section title="5. Data Sharing and Third Parties">
          <Para>
            We do not sell your personal data. Your data is shared only with the following processors under
            strict data processing agreements:
          </Para>
          <BulletList items={[
            'Neon (PostgreSQL) — encrypted database hosting for all records',
            'Supabase Storage — clinic logo and file storage',
            'PayMongo — payment processing for dental service fees (PCI-DSS compliant)',
            'Google (Gmail SMTP) — transactional email delivery for notifications',
            'Google Gemini API — AI-powered appointment suggestions and chatbot responses (no personal health data is transmitted)',
            'Vercel — application hosting and serverless compute',
          ]} />
        </Section>

        <Section title="6. Data Retention">
          <Para>
            Your personal and health data is retained for as long as your patient relationship with the clinic
            is active, or as required by applicable Philippine health regulations. Upon request, patient
            records may be archived (soft-deleted) rather than permanently erased to comply with healthcare
            record-keeping obligations. Authentication and audit data is retained for a minimum of 1 year.
          </Para>
        </Section>

        <Section title="7. Your Rights Under RA 10173">
          <Para>
            As a data subject, you have the following rights under the Philippine Data Privacy Act of 2012:
          </Para>
          <BulletList items={[
            'Right to be Informed — know what data we collect and how it is used',
            'Right to Access — request a copy of your personal data held by the system',
            'Right to Rectification — correct inaccurate or incomplete data',
            'Right to Erasure or Blocking — request deletion of your data, subject to legal retention requirements',
            'Right to Object — object to processing of your data for specific purposes',
            'Right to Data Portability — receive your data in a commonly used electronic format',
            'Right to File a Complaint — lodge a complaint with the National Privacy Commission (NPC) at www.privacy.gov.ph',
          ]} />
          <Para>
            To exercise these rights, contact your clinic administrator or email us at{' '}
            <strong>intellident.inc@gmail.com</strong>.
          </Para>
        </Section>

        <Section title="8. Security Measures (ISO/IEC 27001 & NIST CSF)">
          <Para>
            IntelliDent implements an information security management framework aligned with{' '}
            <strong>ISO/IEC 27001</strong> principles and the{' '}
            <strong>NIST Cybersecurity Framework (Identify, Protect, Detect, Respond, Recover)</strong>:
          </Para>
          <BulletList items={[
            'Access Control — role-based access (RBAC) ensuring users only access data relevant to their role',
            'Encryption — AES-GCM-256 E2EE for health records; TLS in transit for all API communications',
            'Authentication — bcrypt-hashed passwords, email OTP multi-factor authentication, account lockout after 5 failed attempts',
            'Session Management — 10-minute session tokens, 30-minute inactivity auto-logout, Remember Me limited to 3 days',
            'Audit Logging — all create, update, delete, and access events are logged with IP address and user-agent',
            'Rate Limiting — IP-based rate limits on all authentication endpoints to prevent brute-force attacks',
            'Incident Response — security events are logged and reviewable by clinic administrators',
            'Data Minimization — only the minimum data necessary for dental care is collected and processed',
          ]} />
        </Section>

        <Section title="9. Cookies and Session Data">
          <Para>
            IntelliDent uses an HTTP-only, signed session cookie for authentication. No third-party tracking
            cookies or advertising cookies are used. Session data is cleared on sign-out and on inactivity
            timeout.
          </Para>
        </Section>

        <Section title="10. Changes to This Policy">
          <Para>
            We may update these terms and this policy to reflect changes in law or system capabilities.
            Material changes will be communicated via email and displayed on the sign-in page. Continued use
            of IntelliDent after such notice constitutes acceptance of the updated terms.
          </Para>
        </Section>

        <Section title="11. Contact and Data Protection Officer">
          <Para>
            For privacy concerns, data subject requests, or security incident reports, contact:
          </Para>
          <BulletList items={[
            'Email: intellident.inc@gmail.com',
            'National Privacy Commission (Philippines): www.privacy.gov.ph | complaints@privacy.gov.ph',
          ]} />
        </Section>

        <Box sx={{ mt: 3, p: 2.5, bgcolor: '#dbeafe', borderRadius: 2 }}>
          <Typography variant="caption" color="primary" sx={{ lineHeight: 1.7, display: 'block' }}>
            <strong>Governing Law:</strong> These terms are governed by the laws of the Republic of the
            Philippines, including the Data Privacy Act of 2012 (RA 10173), the Electronic Commerce Act of
            2000 (RA 8792), and relevant National Privacy Commission (NPC) issuances.
          </Typography>
        </Box>

      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" disableElevation
          sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
          I Understand
        </Button>
      </DialogActions>
    </Dialog>
  );
}
