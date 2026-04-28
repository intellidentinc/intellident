/**
 * lib/email.js — Mailjet Email Helpers
 *
 * All emails are sent via Mailjet (MJ_APIKEY_PUBLIC + MJ_APIKEY_PRIVATE).
 * Shared sendMail() helper at the bottom centralizes the API call.
 *
 * Auth emails (called directly from API routes):
 *   sendVerificationEmail    — blue header, sent on sign-up (24h token link)
 *   sendPasswordResetEmail   — blue header, sent on forgot-password (10min token link)
 *   sendPasswordChangedEmail — blue header, sent on successful password change
 *
 * Appointment emails (called via lib/notifications.js, always fire-and-forget):
 *   sendAppointmentBookingEmail    — amber  → staff, new booking request
 *   sendAppointmentConfirmedEmail  — green  → patient, booking confirmed
 *   sendAppointmentCancelledEmail  — red    → patient, booking cancelled
 *   sendAppointmentCompletedEmail  — blue   → patient, visit completed
 *   sendAppointmentNoShowEmail     — slate  → patient, marked no-show
 *   sendAppointmentRescheduledEmail — purple → patient, appointment rescheduled
 *   sendAppointmentReminderEmail   — cyan   → patient, 24h or 2h reminder
 *
 * All HTML emails use an inline-styled responsive table layout (no external CSS)
 * for maximum email client compatibility.
 */
import Mailjet from 'node-mailjet';

const mailjet = new Mailjet({
  apiKey: process.env.MJ_APIKEY_PUBLIC,
  apiSecret: process.env.MJ_APIKEY_PRIVATE,
});

export async function sendVerificationEmail({ to, firstName, verificationUrl }) {
  const displayName = firstName || 'there';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your IntelliDent account</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Confirm your email to activate your IntelliDent account. &#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F8FAFC;">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(37,99,235,0.08);overflow:hidden;">

          <!-- Header band -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:40px 48px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <!-- Logo mark -->
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 14px;">
                          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Intelli<span style="color:#93c5fd;">Dent</span></span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:28px;">
                    <!-- Tooth icon using unicode -->
                    <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:28px;">🦷</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;">
                    <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">Confirm your email</h1>
                    <p style="margin:8px 0 0;font-size:15px;color:#bfdbfe;line-height:1.5;">One quick step to activate your account</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#334155;line-height:1.6;">
                Hey <strong>${displayName}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
                Thanks for signing up with <strong style="color:#2563eb;">IntelliDent</strong>! To keep your account secure,
                we need to verify that this email address belongs to you.
                Click the button below to confirm and activate your account.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${verificationUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:10px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                      ✓ &nbsp; Verify My Email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#dbeafe;border-radius:10px;padding:14px 18px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="font-size:18px;padding-right:10px;">⏱</td>
                        <td style="font-size:13px;color:#1d4ed8;line-height:1.5;">
                          This link expires in <strong>24 hours</strong>. If it expires, simply sign up again to receive a new one.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 24px;">
                <tr>
                  <td style="border-top:1px solid #e2e8f0;"></td>
                </tr>
              </table>

              <!-- Security note -->
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#64748b;">Didn't sign up?</strong> You can safely ignore this email — no account will be created.
              </p>
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:6px 0 0;word-break:break-all;">
                <a href="${verificationUrl}" style="font-size:12px;color:#2563eb;text-decoration:underline;">${verificationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #e2e8f0;padding:24px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#334155;">IntelliDent</p>
                    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                      AI-powered dental scheduling &amp; patient records<br/>
                      Serving Maria Laura Cruz Dental Clinic, KH Dental Aesthetics &amp; Cabasal Dental Clinic
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <p style="margin:0;font-size:11px;color:#cbd5e1;">🔒 End-to-end encrypted</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:16px;">
                    <p style="margin:0;font-size:11px;color:#cbd5e1;line-height:1.5;">
                      This is an automated message. Please do not reply to this email.<br/>
                      © ${new Date().getFullYear()} IntelliDent. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();

  const text = `
Hey ${displayName},

Thanks for signing up with IntelliDent! Please verify your email address to activate your account.

Verification link (expires in 24 hours):
${verificationUrl}

If you didn't sign up, you can safely ignore this email.

— IntelliDent
  `.trim();

  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: process.env.MJ_FROM_EMAIL, Name: process.env.MJ_FROM_NAME },
        To: [{ Email: to }],
        Subject: 'Verify your IntelliDent account',
        TextPart: text,
        HTMLPart: html,
      },
    ],
  });
}

export async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  const displayName = firstName || 'there';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F8FAFC;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(37,99,235,0.08);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:40px 48px 36px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Intelli<span style="color:#93c5fd;">Dent</span></span>
            <div style="margin-top:24px;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:28px;">🔑</div>
            <h1 style="margin:16px 0 0;font-size:26px;font-weight:700;color:#ffffff;">Reset your password</h1>
            <p style="margin:8px 0 0;font-size:15px;color:#bfdbfe;">We received a request to reset your password</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px 32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
              Click the button below to reset your password. This link is valid for <strong>10 minutes</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding:8px 0 32px;">
                  <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:10px;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                    Reset Password
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#fef3c7;border-radius:10px;padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td style="font-size:18px;padding-right:10px;">⚠️</td>
                    <td style="font-size:13px;color:#92400e;line-height:1.5;">
                      This link expires in <strong>10 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
              If the button doesn't work, copy and paste this link:<br/>
              <a href="${resetUrl}" style="font-size:12px;color:#2563eb;word-break:break-all;">${resetUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #e2e8f0;padding:24px 48px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">IntelliDent</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">AI-powered dental scheduling &amp; patient records</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = `Hey ${displayName},\n\nReset your IntelliDent password using the link below (expires in 10 minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— IntelliDent`;

  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: process.env.MJ_FROM_EMAIL, Name: process.env.MJ_FROM_NAME },
        To: [{ Email: to }],
        Subject: 'Reset your IntelliDent password',
        TextPart: text,
        HTMLPart: html,
      },
    ],
  });
}

// ─── Appointment Email Helpers ────────────────────────────────────────────────

function emailWrapper(headerColor, icon, headingText, subText, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F8FAFC;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(37,99,235,0.08);overflow:hidden;">
        <tr>
          <td style="background:${headerColor};padding:36px 48px 32px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Intelli<span style="color:#93c5fd;">Dent</span></span>
            <div style="margin-top:20px;width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:52px;font-size:26px;">${icon}</div>
            <h1 style="margin:14px 0 0;font-size:24px;font-weight:700;color:#ffffff;">${headingText}</h1>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">${subText}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 48px 32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #e2e8f0;padding:20px 48px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">IntelliDent</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">AI-powered dental scheduling &amp; patient records</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()
}

function apptInfoBlock(details) {
  const rows = details.map(([label, value]) =>
    `<tr><td style="font-size:13px;color:#64748b;padding:5px 0;white-space:nowrap;padding-right:16px;">${label}</td><td style="font-size:13px;color:#334155;font-weight:500;padding:5px 0;">${value}</td></tr>`
  ).join('')
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;border-radius:10px;padding:16px 20px;width:100%;margin-bottom:20px;">${rows}</table>`
}

export async function sendAppointmentBookingEmail({ to, staffName, patientName, serviceName, scheduledAt, appointmentCode }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${staffName || 'there'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">A new appointment booking request has been submitted and is awaiting your review.</p>
    ${apptInfoBlock([['Patient', patientName], ['Service', serviceName], ['Date & Time', dateStr], ['Reference', appointmentCode ?? '—']])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">Please log in to IntelliDent to confirm or manage this appointment.</p>
  `
  const html = emailWrapper('linear-gradient(135deg,#d97706 0%,#b45309 100%)', '📅', 'New Booking Request', 'A patient has requested an appointment', body)
  const text = `Hey ${staffName || 'there'},\n\nNew booking request:\nPatient: ${patientName}\nService: ${serviceName}\nDate: ${dateStr}\nRef: ${appointmentCode ?? '—'}\n\nPlease log in to IntelliDent to review.\n\n— IntelliDent`
  await sendMail(to, 'New Appointment Booking Request — IntelliDent', text, html)
}

export async function sendAppointmentConfirmedEmail({ to, firstName, serviceName, scheduledAt, appointmentCode }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">Great news! Your appointment has been confirmed. We look forward to seeing you.</p>
    ${apptInfoBlock([['Service', serviceName], ['Date & Time', dateStr], ['Reference', appointmentCode ?? '—']])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">Please arrive a few minutes early. If you need to reschedule, contact the clinic as soon as possible.</p>
  `
  const html = emailWrapper('linear-gradient(135deg,#15803d 0%,#166534 100%)', '✅', 'Appointment Confirmed', 'Your booking is confirmed', body)
  const text = `Hey ${firstName || 'there'},\n\nYour appointment is confirmed!\nService: ${serviceName}\nDate: ${dateStr}\nRef: ${appointmentCode ?? '—'}\n\n— IntelliDent`
  await sendMail(to, 'Appointment Confirmed — IntelliDent', text, html)
}

export async function sendAppointmentCancelledEmail({ to, firstName, serviceName, scheduledAt, appointmentCode }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">Your appointment has been cancelled. We're sorry for any inconvenience.</p>
    ${apptInfoBlock([['Service', serviceName], ['Date & Time', dateStr], ['Reference', appointmentCode ?? '—']])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">You may book a new appointment at any time through IntelliDent.</p>
  `
  const html = emailWrapper('linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)', '❌', 'Appointment Cancelled', 'Your appointment has been cancelled', body)
  const text = `Hey ${firstName || 'there'},\n\nYour appointment has been cancelled.\nService: ${serviceName}\nDate: ${dateStr}\nRef: ${appointmentCode ?? '—'}\n\n— IntelliDent`
  await sendMail(to, 'Appointment Cancelled — IntelliDent', text, html)
}

export async function sendAppointmentCompletedEmail({ to, firstName, serviceName, scheduledAt }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">Thank you for visiting us! Your appointment has been marked as completed.</p>
    ${apptInfoBlock([['Service', serviceName], ['Date', dateStr]])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">We hope to see you again soon. Book your next appointment through IntelliDent anytime.</p>
  `
  const html = emailWrapper('linear-gradient(135deg,#1d4ed8 0%,#1e3a8a 100%)', '🦷', 'Visit Completed', 'Thank you for your visit!', body)
  const text = `Hey ${firstName || 'there'},\n\nThank you for your visit!\nService: ${serviceName}\nDate: ${dateStr}\n\n— IntelliDent`
  await sendMail(to, 'Thank You for Your Visit — IntelliDent', text, html)
}

export async function sendAppointmentNoShowEmail({ to, firstName, serviceName, scheduledAt }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">We noticed you were unable to make it to your appointment. We've marked it as a no-show.</p>
    ${apptInfoBlock([['Service', serviceName], ['Scheduled', dateStr]])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">If this was a mistake or you'd like to reschedule, please contact the clinic.</p>
  `
  const html = emailWrapper('linear-gradient(135deg,#475569 0%,#334155 100%)', '⚠️', 'Appointment No-show', 'We missed you at your appointment', body)
  const text = `Hey ${firstName || 'there'},\n\nYou were marked as no-show for:\nService: ${serviceName}\nScheduled: ${dateStr}\n\nPlease contact the clinic to reschedule.\n\n— IntelliDent`
  await sendMail(to, 'Appointment No-show — IntelliDent', text, html)
}

export async function sendAppointmentRescheduledEmail({ to, firstName, serviceName, scheduledAt, appointmentCode }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">Your appointment has been rescheduled. Please review the updated details below.</p>
    ${apptInfoBlock([['Service', serviceName], ['New Date & Time', dateStr], ['Reference', appointmentCode ?? '—']])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">If you have any concerns, please contact the clinic directly.</p>
  `
  const html = emailWrapper('linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)', '🔄', 'Appointment Rescheduled', 'Your appointment date has changed', body)
  const text = `Hey ${firstName || 'there'},\n\nYour appointment has been rescheduled.\nService: ${serviceName}\nNew Date: ${dateStr}\nRef: ${appointmentCode ?? '—'}\n\n— IntelliDent`
  await sendMail(to, 'Appointment Rescheduled — IntelliDent', text, html)
}

export async function sendAppointmentReminderEmail({ to, firstName, serviceName, scheduledAt, appointmentCode, hoursAhead }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  const label = hoursAhead === 2 ? 'in 2 hours' : 'tomorrow'
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${firstName || 'there'}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">Just a friendly reminder — you have an appointment <strong>${label}</strong>!</p>
    ${apptInfoBlock([['Service', serviceName], ['Date & Time', dateStr], ['Reference', appointmentCode ?? '—']])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">Please arrive a few minutes early. Contact the clinic if you need to make any changes.</p>
  `
  const html = emailWrapper('linear-gradient(135deg,#0891b2 0%,#0e7490 100%)', '⏰', `Appointment ${label === 'tomorrow' ? 'Tomorrow' : 'in 2 Hours'}`, `Your appointment is coming up ${label}`, body)
  const text = `Hey ${firstName || 'there'},\n\nReminder: you have an appointment ${label}.\nService: ${serviceName}\nDate: ${dateStr}\nRef: ${appointmentCode ?? '—'}\n\n— IntelliDent`
  await sendMail(to, `Appointment Reminder — ${label === 'tomorrow' ? '24-Hour' : '2-Hour'} Notice — IntelliDent`, text, html)
}

export async function sendMfaOtpEmail({ to, firstName, code }) {
  const displayName = firstName || 'there'
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F8FAFC;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(37,99,235,0.08);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:40px 48px 36px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Intelli<span style="color:#93c5fd;">Dent</span></span>
            <div style="margin-top:24px;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:28px;">🔐</div>
            <h1 style="margin:16px 0 0;font-size:26px;font-weight:700;color:#ffffff;">Your sign-in code</h1>
            <p style="margin:8px 0 0;font-size:15px;color:#bfdbfe;">Two-factor authentication code</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px 32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
              Use the code below to complete your sign-in to <strong style="color:#2563eb;">IntelliDent</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding:8px 0 32px;">
                  <div style="display:inline-block;background:#dbeafe;border-radius:12px;padding:20px 48px;">
                    <span style="font-size:40px;font-weight:800;color:#1d4ed8;letter-spacing:12px;">${code}</span>
                  </div>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#fef3c7;border-radius:10px;padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td style="font-size:18px;padding-right:10px;">⏱</td>
                    <td style="font-size:13px;color:#92400e;line-height:1.5;">
                      This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
              <strong style="color:#64748b;">Didn't try to sign in?</strong> Someone may have your password. We recommend changing it immediately.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #e2e8f0;padding:24px 48px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">IntelliDent</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">AI-powered dental scheduling &amp; patient records</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()

  const text = `Hey ${displayName},\n\nYour IntelliDent sign-in code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nIf you didn't try to sign in, please change your password immediately.\n\n— IntelliDent`

  await sendMail(to, 'Your IntelliDent sign-in code', text, html)
}

async function sendMail(to, subject, text, html) {
  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: process.env.MJ_FROM_EMAIL, Name: process.env.MJ_FROM_NAME },
        To: [{ Email: to }],
        Subject: subject,
        TextPart: text,
        HTMLPart: html,
      },
    ],
  })
}

// ─── Auth Email Functions ─────────────────────────────────────────────────────

export async function sendPasswordChangedEmail({ to, firstName }) {
  const displayName = firstName || 'there';
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F8FAFC;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(37,99,235,0.08);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:40px 48px 36px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Intelli<span style="color:#93c5fd;">Dent</span></span>
            <div style="margin-top:24px;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:28px;">🔒</div>
            <h1 style="margin:16px 0 0;font-size:26px;font-weight:700;color:#ffffff;">Password changed</h1>
            <p style="margin:8px 0 0;font-size:15px;color:#bfdbfe;">Your account password was successfully updated</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px 32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
              Your IntelliDent password was successfully changed. If you made this change, no further action is needed.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#fee2e2;border-radius:10px;padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td style="font-size:18px;padding-right:10px;">🚨</td>
                    <td style="font-size:13px;color:#991b1b;line-height:1.5;">
                      If you did <strong>not</strong> make this change, please contact your clinic administrator immediately.
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-top:1px solid #e2e8f0;padding:24px 48px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">IntelliDent</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">AI-powered dental scheduling &amp; patient records</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = `Hey ${displayName},\n\nYour IntelliDent password was successfully changed.\n\nIf you did not make this change, contact your clinic administrator immediately.\n\n— IntelliDent`;

  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: process.env.MJ_FROM_EMAIL, Name: process.env.MJ_FROM_NAME },
        To: [{ Email: to }],
        Subject: 'Your IntelliDent password was changed',
        TextPart: text,
        HTMLPart: html,
      },
    ],
  });
}
