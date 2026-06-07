import nodemailer from 'nodemailer';
import moment from 'moment-timezone';

function fmtDateTime(dt) {
  return moment(dt).tz('Asia/Manila').format('MMM D, YYYY h:mm A');
}
function fmtDate(dt) {
  return moment(dt).tz('Asia/Manila').format('MMM D, YYYY');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
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

  await sendMail(to, 'Verify your IntelliDent account', text, html);
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

  await sendMail(to, 'Reset your IntelliDent password', text, html);
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

const APPT_TYPE_STYLE = {
  BOOKING_REQUEST:         { color: 'linear-gradient(135deg,#d97706 0%,#b45309 100%)', icon: '📅', sub: 'Appointment notification' },
  APPOINTMENT_CONFIRMED:   { color: 'linear-gradient(135deg,#15803d 0%,#166534 100%)', icon: '✅', sub: 'Appointment notification' },
  APPOINTMENT_CANCELLED:   { color: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)', icon: '❌', sub: 'Appointment notification' },
  APPOINTMENT_COMPLETED:   { color: 'linear-gradient(135deg,#1d4ed8 0%,#1e3a8a 100%)', icon: '🦷', sub: 'Appointment notification' },
  APPOINTMENT_NO_SHOW:     { color: 'linear-gradient(135deg,#475569 0%,#334155 100%)', icon: '⚠️', sub: 'Appointment notification' },
  APPOINTMENT_RESCHEDULED: { color: 'linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%)', icon: '🔄', sub: 'Appointment notification' },
  REMINDER_24H:            { color: 'linear-gradient(135deg,#0891b2 0%,#0e7490 100%)', icon: '⏰', sub: 'Appointment reminder' },
  REMINDER_2H:             { color: 'linear-gradient(135deg,#0891b2 0%,#0e7490 100%)', icon: '⏰', sub: 'Appointment reminder' },
}

export async function sendCustomAppointmentEmail({ to, subject, body, typeKey }) {
  const style = APPT_TYPE_STYLE[typeKey] ?? { color: 'linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)', icon: '📧', sub: 'Notification from IntelliDent' }
  const bodyHtml = `<p style="margin:0;font-size:15px;color:#475569;line-height:1.8;white-space:pre-wrap;">${body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
  const html = emailWrapper(style.color, style.icon, subject, style.sub, bodyHtml)
  await sendMail(to, subject, body, html)
}

export async function sendAppointmentBookingEmail({ to, staffName, patientName, serviceName, scheduledAt, appointmentCode }) {
  const dateStr = fmtDateTime(scheduledAt)
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
  const dateStr = fmtDateTime(scheduledAt)
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
  const dateStr = fmtDateTime(scheduledAt)
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
  const dateStr = fmtDate(scheduledAt)
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
  const dateStr = fmtDateTime(scheduledAt)
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
  const dateStr = fmtDateTime(scheduledAt)
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
  const dateStr = fmtDateTime(scheduledAt)
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
  await transporter.sendMail({
    from: `"${process.env.GMAIL_FROM_NAME ?? 'IntelliDent'}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
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

  await sendMail(to, 'Your IntelliDent password was changed', text, html);
}

export async function sendStaffWelcomeEmail({ to, firstName, role, tempPassword, username }) {
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
            <div style="margin-top:24px;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:28px;">👋</div>
            <h1 style="margin:16px 0 0;font-size:26px;font-weight:700;color:#ffffff;">Welcome to IntelliDent</h1>
            <p style="margin:8px 0 0;font-size:15px;color:#bfdbfe;">Your account has been created</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px 32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
              Your IntelliDent account has been set up by your clinic administrator as a <strong>${role}</strong>. Use the credentials below to sign in.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;border-radius:10px;padding:16px 20px;width:100%;margin-bottom:24px;">
              <tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0;white-space:nowrap;padding-right:16px;">Email</td>
                <td style="font-size:13px;color:#334155;font-weight:500;padding:5px 0;">${to}</td>
              </tr>
              ${username ? `<tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0;white-space:nowrap;padding-right:16px;">Username</td>
                <td style="font-size:13px;color:#334155;font-weight:500;padding:5px 0;font-family:monospace;">${username}</td>
              </tr>` : ''}
              <tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0;white-space:nowrap;padding-right:16px;">Temporary Password</td>
                <td style="font-size:13px;color:#334155;font-weight:500;padding:5px 0;font-family:monospace;">${tempPassword}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#fef3c7;border-radius:10px;padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td style="font-size:18px;padding-right:10px;">⚠️</td>
                    <td style="font-size:13px;color:#92400e;line-height:1.5;">
                      You will be <strong>required to change your password</strong> on your first sign-in before you can access the system.
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

  const text = `Hey ${displayName},\n\nYour IntelliDent account has been set up by your clinic administrator as a ${role}.\n\nEmail: ${to}${username ? `\nUsername: ${username}` : ''}\nTemporary Password: ${tempPassword}\n\nYou will be required to change your password on your first sign-in.\n\n— IntelliDent`;

  await sendMail(to, 'Welcome to IntelliDent — Your account is ready', text, html);
}

// ─── Patient Account Claim Email ─────────────────────────────────────────────

export async function sendPatientClaimEmail({ to, firstName, patientCode, tempPassword, clinicName, signInUrl }) {
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
            <div style="margin-top:24px;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:28px;">🦷</div>
            <h1 style="margin:16px 0 0;font-size:26px;font-weight:700;color:#ffffff;">Your Patient Account</h1>
            <p style="margin:8px 0 0;font-size:15px;color:#bfdbfe;">Sign in to access your dental records</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px 32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
              Your patient account has been created at <strong>${clinicName}</strong>. Use the credentials below to sign in and access your appointments and dental records.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;border-radius:10px;padding:16px 20px;width:100%;margin-bottom:24px;">
              <tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0;white-space:nowrap;padding-right:16px;">Email</td>
                <td style="font-size:13px;color:#334155;font-weight:500;padding:5px 0;">${to}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0;white-space:nowrap;padding-right:16px;">Patient Code</td>
                <td style="font-size:13px;color:#2563eb;font-weight:700;padding:5px 0;font-family:monospace;">${patientCode ?? '—'}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0;white-space:nowrap;padding-right:16px;">Temporary Password</td>
                <td style="font-size:13px;color:#334155;font-weight:500;padding:5px 0;font-family:monospace;">${tempPassword}</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding:0 0 24px;">
                  <a href="${signInUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                    Sign In Now
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
                      You will be <strong>required to change your password</strong> on your first sign-in.
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
</html>`.trim()

  const text = `Hey ${displayName},\n\nYour patient account has been created at ${clinicName}.\n\nEmail: ${to}\nPatient Code: ${patientCode ?? '—'}\nTemporary Password: ${tempPassword}\n\nSign in at: ${signInUrl}\n\nYou will be required to change your password on your first sign-in.\n\n— IntelliDent`

  await sendMail(to, `Your IntelliDent Patient Account – ${clinicName}`, text, html)
}

// ─── Clinic Application Emails ────────────────────────────────────────────────

export async function sendClinicApplicationReceived({ clinicName, applicantName, email }) {
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${applicantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      Thank you for applying to join <strong style="color:#2563eb;">IntelliDent</strong>! We've received your application for
      <strong>${clinicName}</strong> and our team will review it within a few business days.
    </p>
    ${apptInfoBlock([['Clinic', clinicName], ['Contact Email', email]])}
    <p style="margin:0;font-size:13px;color:#94a3b8;">We'll notify you at this email address once a decision has been made. Thank you for your patience.</p>
  `
  const html = emailWrapper(
    'linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)',
    '🏥',
    'Application Received',
    'We\'ve received your clinic registration request',
    body,
  )
  const text = `Hey ${applicantName},\n\nWe've received your IntelliDent clinic application for "${clinicName}". Our team will review it within a few business days and contact you at ${email}.\n\n— IntelliDent`
  await sendMail(email, 'Application Received — IntelliDent', text, html)
}

export async function sendClinicApplicationApproved({ clinicName, applicantName, email, signUpUrl }) {
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${applicantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      Great news! Your IntelliDent clinic application for <strong>${clinicName}</strong> has been approved.
      Your clinic is now live on the platform.
    </p>
    ${apptInfoBlock([['Clinic', clinicName]])}
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
      To get started, sign up for an account using this email address. Once you've signed in, contact the IntelliDent team to have your role upgraded to <strong>Admin</strong> so you can manage your clinic.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:0 0 24px;">
          <a href="${signUpUrl}" style="display:inline-block;background:linear-gradient(135deg,#15803d 0%,#166534 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(21,128,61,0.35);">
            Sign Up Now
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Welcome to IntelliDent — we're excited to have your clinic on the platform!</p>
  `
  const html = emailWrapper(
    'linear-gradient(135deg,#15803d 0%,#166534 100%)',
    '✅',
    'Clinic Application Approved',
    'Your clinic is now live on IntelliDent',
    body,
  )
  const text = `Hey ${applicantName},\n\nCongratulations! Your IntelliDent clinic application for "${clinicName}" has been approved.\n\nSign up at: ${signUpUrl}\n\nAfter signing up, contact us to have your role upgraded to Admin.\n\n— IntelliDent`
  await sendMail(email, 'Your Clinic Application is Approved — IntelliDent', text, html)
}

export async function sendClinicApplicationRejected({ clinicName, applicantName, email, reason }) {
  const reasonBlock = reason
    ? apptInfoBlock([['Reason', reason]])
    : ''
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${applicantName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      Thank you for your interest in IntelliDent. After reviewing your application for
      <strong>${clinicName}</strong>, we're unable to approve it at this time.
    </p>
    ${reasonBlock}
    <p style="margin:0;font-size:13px;color:#94a3b8;">You are welcome to submit a new application in the future. If you have any questions, please reach out to our team.</p>
  `
  const html = emailWrapper(
    'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)',
    '❌',
    'Application Not Approved',
    'An update on your clinic registration request',
    body,
  )
  const text = `Hey ${applicantName},\n\nWe've reviewed your IntelliDent application for "${clinicName}" and are unable to approve it at this time.${reason ? `\n\nReason: ${reason}` : ''}\n\nYou are welcome to reapply in the future.\n\n— IntelliDent`
  await sendMail(email, 'Update on Your IntelliDent Clinic Application', text, html)
}

export async function sendSuspiciousLoginAlert({ to, firstName, isNewDevice, suspiciousIp, previousIp, ip, time }) {
  const displayName = firstName || 'there'
  const timeStr = fmtDateTime(time)
  const flagRows = [
    ...(isNewDevice  ? [['Reason',      'Sign-in from an unrecognized device']] : []),
    ...(suspiciousIp ? [['Reason',      'Sign-in from a new IP address']]       : []),
    ['IP Address', ip ?? 'Unknown'],
    ...(previousIp   ? [['Previous IP', previousIp]]                            : []),
    ['Time',       timeStr],
  ]
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      We detected a suspicious sign-in on your IntelliDent account.
      If this was you, no action is needed. If you don't recognize this activity,
      change your password immediately and contact your clinic administrator.
    </p>
    ${apptInfoBlock(flagRows)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr><td style="background:#fee2e2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 18px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:20px;padding-right:12px;">🚨</td>
          <td style="font-size:14px;color:#991b1b;line-height:1.6;">
            If you did not sign in, contact your clinic administrator immediately and change your password.
          </td>
        </tr></table>
      </td></tr>
    </table>
  `
  const html = emailWrapper(
    'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)',
    '🔐',
    'Suspicious Sign-in Detected',
    'We noticed unusual activity on your account',
    body,
  )
  const text = `Hey ${displayName},\n\nWe detected a suspicious sign-in on your IntelliDent account.\n\nIP Address: ${ip ?? 'Unknown'}${previousIp ? `\nPrevious IP: ${previousIp}` : ''}\nTime: ${timeStr}\n\nIf this wasn't you, change your password and contact your clinic administrator immediately.\n\n— IntelliDent`
  await sendMail(to, 'Suspicious Sign-in Detected — IntelliDent', text, html)
}

export async function sendAccountLockedAlert({ to, firstName, lockedUntil }) {
  const displayName = firstName || 'there'
  const lockStr = fmtDateTime(lockedUntil)
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      Your IntelliDent account has been temporarily locked due to multiple
      failed sign-in attempts. This is a security measure to protect your account.
    </p>
    ${apptInfoBlock([['Locked Until', lockStr]])}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr><td style="background:#fef3c7;border-left:4px solid #d97706;border-radius:6px;padding:14px 18px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:20px;padding-right:12px;">⚠️</td>
          <td style="font-size:14px;color:#92400e;line-height:1.6;">
            If you didn't make these attempts, someone may have your credentials.
            Contact your clinic administrator as soon as possible.
          </td>
        </tr></table>
      </td></tr>
    </table>
  `
  const html = emailWrapper(
    'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)',
    '🔒',
    'Account Temporarily Locked',
    'Your account has been locked for security',
    body,
  )
  const text = `Hey ${displayName},\n\nYour IntelliDent account has been temporarily locked until ${lockStr} due to multiple failed sign-in attempts.\n\nIf this wasn't you, contact your clinic administrator immediately.\n\n— IntelliDent`
  await sendMail(to, 'Your IntelliDent Account Has Been Locked — IntelliDent', text, html)
}

export async function sendBreachAlertEmail({ to, adminFirstName, breachType, details, clinicName, detectedAt }) {
  const displayName = adminFirstName || 'Admin'
  const timeStr = fmtDateTime(detectedAt)
  const isCritical = breachType === 'DISTRIBUTED_BRUTE_FORCE'
  const severityLabel = isCritical ? 'CRITICAL' : 'HIGH'
  const severityColor = isCritical ? '#dc2626' : '#d97706'
  const patternLabel = breachType.replace(/_/g, ' ')
  const detailRows = Object.entries(details).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').trim(), String(v)])
  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      IntelliDent's automated breach detection system has identified a potential
      security incident at <strong>${clinicName}</strong> that requires your immediate attention.
    </p>
    ${apptInfoBlock([
      ['Clinic',       clinicName],
      ['Pattern',      patternLabel],
      ['Severity',     severityLabel],
      ['Detected At',  timeStr],
      ...detailRows,
    ])}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr><td style="background:#fee2e2;border-left:4px solid ${severityColor};border-radius:6px;padding:14px 18px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:20px;padding-right:12px;">🚨</td>
          <td style="font-size:14px;color:#991b1b;line-height:1.6;">
            Please review the audit logs immediately and take appropriate action.
            If credentials have been compromised, reset affected accounts without delay.
          </td>
        </tr></table>
      </td></tr>
    </table>
  `
  const html = emailWrapper(
    `linear-gradient(135deg,${severityColor} 0%,#991b1b 100%)`,
    '🛡️',
    'Security Breach Alert',
    `Potential breach detected at ${clinicName}`,
    body,
  )
  const text = `Hey ${displayName},\n\nSecurity Alert — ${clinicName}\nPattern: ${patternLabel}\nSeverity: ${severityLabel}\nDetected: ${timeStr}\n\n${detailRows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nPlease review the audit logs immediately.\n\n— IntelliDent`
  await sendMail(to, `Security Breach Alert — ${clinicName} — IntelliDent`, text, html)
}

export async function sendRestoreOtpEmail({ to, firstName, code, clinicName }) {
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
          <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:40px 48px 36px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Intelli<span style="color:#fca5a5;">Dent</span></span>
            <div style="margin-top:24px;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:28px;">🗄️</div>
            <h1 style="margin:16px 0 0;font-size:26px;font-weight:700;color:#ffffff;">Restore Authorization Code</h1>
            <p style="margin:8px 0 0;font-size:15px;color:#fecaca;">Data restore confirmation — sensitive operation</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px 32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#334155;">Hey <strong>${displayName}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
              A data restore authorization has been requested for clinic <strong style="color:#dc2626;">${clinicName}</strong>.
              Use the code below to confirm this operation. This code expires in <strong>10 minutes</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center" style="padding:8px 0 32px;">
                  <div style="display:inline-block;background:#fee2e2;border-radius:12px;padding:20px 48px;">
                    <span style="font-size:40px;font-weight:800;color:#b91c1c;letter-spacing:12px;">${code}</span>
                  </div>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#fee2e2;border-radius:10px;padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0" role="presentation"><tr>
                    <td style="font-size:18px;padding-right:10px;">🚨</td>
                    <td style="font-size:13px;color:#991b1b;line-height:1.5;">
                      <strong>This is a high-privilege operation.</strong> If you did not initiate a data restore,
                      do not share this code. Contact your security team immediately.
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
</html>`.trim()

  const text = `Hey ${displayName},\n\nRestore Authorization for ${clinicName}\n\nYour confirmation code is: ${code}\n\nThis code expires in 10 minutes. Do NOT share it with anyone.\n\nIf you did not initiate a restore operation, contact your security team immediately.\n\n— IntelliDent`

  await sendMail(to, `Data Restore Authorization Code — IntelliDent`, text, html)
}
