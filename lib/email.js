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
