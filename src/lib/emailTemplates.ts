export interface EmailTemplate {
  id: string;
  name: string;
  category: "auth" | "billing" | "team";
  description: string;
  defaultSubject: string;
  variables: { name: string; desc: string }[];
  html: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "magic_link",
    name: "Magic Link & One-Time Login",
    category: "auth",
    description: "Sent when users choose passwordless login or request a direct magic sign-in link.",
    defaultSubject: "Your GeFlow One-Time Login Link & Code: {{ .Token }}",
    variables: [
      { name: "{{ .ConfirmationURL }}", desc: "Dynamic 1-click direct authentication URL" },
      { name: "{{ .Token }}", desc: "6-digit numeric login verification code" },
      { name: "{{ .SiteURL }}", desc: "Website origin URL" },
      { name: "{{ .Email }}", desc: "Recipient user email address" },
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GeFlow One-Time Login</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0f17; color: #f1f5f9; }
    .container { max-width: 580px; margin: 40px auto; background: #131825; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(56,189,248,0.08) 0%, rgba(19,24,37,0) 100%); }
    .logo-text { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; text-decoration: none; display: inline-block; }
    .logo-accent { color: #38bdf8; }
    .badge { display: inline-block; padding: 6px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.25); border-radius: 100px; margin-top: 12px; }
    .content { padding: 36px 40px; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 12px; }
    .desc { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 28px; }
    .code-box { background: #0b0e14; border: 1px dashed #38bdf8; border-radius: 16px; padding: 18px 24px; margin: 0 auto 28px; display: inline-block; min-width: 240px; }
    .code-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 6px; }
    .code-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #38bdf8; }
    .btn { display: inline-block; background: #38bdf8; color: #041017 !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 10px 20px rgba(56,189,248,0.25); }
    .divider { height: 1px; background: #1e293b; margin: 32px 0 24px; }
    .footer { padding: 0 40px 36px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
    .footer a { color: #94a3b8; text-decoration: underline; }
    .security-note { font-size: 12px; color: #64748b; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">Ge<span class="logo-accent">Flow</span></div>
      <div><span class="badge">Passwordless Authentication</span></div>
    </div>
    
    <div class="content">
      <h1 class="title">Your One-Time Login Link</h1>
      <p class="desc">
        Click the button below or use your 6-digit code to securely sign in to your GeFlow account without entering a password.
      </p>

      <!-- 6-digit OTP Code Box -->
      <div class="code-box">
        <div class="code-label">One-Time Security Code</div>
        <div class="code-value">{{ .Token }}</div>
      </div>

      <div>
        <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">
          👉 Instant Log In to GeFlow
        </a>
      </div>

      <p class="security-note">
        This link and code will expire in 10 minutes. If you did not request this email, you can safely ignore it.
      </p>

      <div class="divider"></div>

      <p style="font-size: 12px; color: #64748b; margin: 0;">
        Trouble clicking the button? Copy and paste this URL into your browser:<br>
        <span style="color: #38bdf8; word-break: break-all;">{{ .ConfirmationURL }}</span>
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px;">GeFlow Business Cloud Management Platform</p>
      <p style="margin: 0;">Support: <a href="mailto:gepardwebs@gmail.com">gepardwebs@gmail.com</a> &bull; <a href="{{ .SiteURL }}">Visit Workspace</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: "signup_confirmation",
    name: "Confirm Signup & Welcome",
    category: "auth",
    description: "Sent to new users when creating an account to verify their email address.",
    defaultSubject: "Welcome to GeFlow — Confirm Your Account",
    variables: [
      { name: "{{ .ConfirmationURL }}", desc: "Account confirmation link" },
      { name: "{{ .Token }}", desc: "Confirmation security token code" },
      { name: "{{ .SiteURL }}", desc: "Website URL" },
      { name: "{{ .Email }}", desc: "User email" },
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to GeFlow</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0c0f17; color: #f1f5f9; }
    .container { max-width: 580px; margin: 40px auto; background: #131825; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); background: linear-gradient(180deg, rgba(56,189,248,0.08) 0%, rgba(19,24,37,0) 100%); }
    .logo-text { font-size: 26px; font-weight: 800; color: #ffffff; text-decoration: none; display: inline-block; }
    .logo-accent { color: #38bdf8; }
    .badge { display: inline-block; padding: 6px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #10b981; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); border-radius: 100px; margin-top: 12px; }
    .content { padding: 36px 40px; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 12px; }
    .desc { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 28px; }
    .btn { display: inline-block; background: #38bdf8; color: #041017 !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 10px 20px rgba(56,189,248,0.25); }
    .divider { height: 1px; background: #1e293b; margin: 32px 0 24px; }
    .footer { padding: 0 40px 36px; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #94a3b8; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">Ge<span class="logo-accent">Flow</span></div>
      <div><span class="badge">Welcome Onboard</span></div>
    </div>
    
    <div class="content">
      <h1 class="title">Confirm Your Email Address</h1>
      <p class="desc">
        Thank you for joining GeFlow. Please click the button below to verify your email address and activate your business workspace.
      </p>

      <div>
        <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">
          ✓ Verify Email & Activate Account
        </a>
      </div>

      <div class="divider"></div>

      <p style="font-size: 12px; color: #64748b; margin: 0;">
        If button doesn't work, copy this link: <br>
        <span style="color: #38bdf8; word-break: break-all;">{{ .ConfirmationURL }}</span>
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px;">GeFlow POS & Inventory Management</p>
      <p style="margin: 0;">Support: <a href="mailto:gepardwebs@gmail.com">gepardwebs@gmail.com</a></p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: "reset_password",
    name: "Reset Password",
    category: "auth",
    description: "Sent when users request to reset their account password.",
    defaultSubject: "Reset Your GeFlow Password",
    variables: [
      { name: "{{ .ConfirmationURL }}", desc: "Password recovery link" },
      { name: "{{ .Token }}", desc: "Recovery token code" },
      { name: "{{ .SiteURL }}", desc: "Website URL" },
      { name: "{{ .Email }}", desc: "User email" },
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset GeFlow Password</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0c0f17; color: #f1f5f9; }
    .container { max-width: 580px; margin: 40px auto; background: #131825; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; }
    .header { padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo-text { font-size: 26px; font-weight: 800; color: #ffffff; text-decoration: none; }
    .logo-accent { color: #38bdf8; }
    .content { padding: 36px 40px; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 12px; }
    .desc { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 28px; }
    .btn { display: inline-block; background: #f43f5e; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; }
    .footer { padding: 24px 40px 36px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">Ge<span class="logo-accent">Flow</span></div>
    </div>
    
    <div class="content">
      <h1 class="title">Reset Your Password</h1>
      <p class="desc">
        We received a request to reset the password for your GeFlow account. Click the button below to set a new password:
      </p>

      <div>
        <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">
          🔒 Reset Password
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        If you did not request a password reset, you can safely ignore this email. Your password will not change.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0;">GeFlow Security • Support: gepardwebs@gmail.com</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: "change_email",
    name: "Change Email Address",
    category: "auth",
    description: "Sent when an existing user updates their registered email address.",
    defaultSubject: "Confirm Your New Email Address for GeFlow",
    variables: [
      { name: "{{ .ConfirmationURL }}", desc: "Confirm new email link" },
      { name: "{{ .Token }}", desc: "Verification token code" },
      { name: "{{ .SiteURL }}", desc: "Website URL" },
      { name: "{{ .Email }}", desc: "New email address" },
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Email Change</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0c0f17; color: #f1f5f9; }
    .container { max-width: 580px; margin: 40px auto; background: #131825; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; }
    .header { padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo-text { font-size: 26px; font-weight: 800; color: #ffffff; text-decoration: none; }
    .logo-accent { color: #38bdf8; }
    .content { padding: 36px 40px; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 12px; }
    .desc { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 28px; }
    .btn { display: inline-block; background: #38bdf8; color: #041017 !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; }
    .footer { padding: 24px 40px 36px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">Ge<span class="logo-accent">Flow</span></div>
    </div>
    
    <div class="content">
      <h1 class="title">Confirm New Email Address</h1>
      <p class="desc">
        A request was made to update your GeFlow account email to this address. Click the button below to confirm and activate this change:
      </p>

      <div>
        <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">
          ✓ Confirm Email Change
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        If you did not request this update, please contact our security team immediately at gepardwebs@gmail.com.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0;">GeFlow Security • Support: gepardwebs@gmail.com</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: "invite_user",
    name: "Team Member Invite",
    category: "team",
    description: "Sent when an administrator invites a colleague or employee to a business workspace.",
    defaultSubject: "You've been invited to join a GeFlow Workspace",
    variables: [
      { name: "{{ .ConfirmationURL }}", desc: "Accept invitation URL" },
      { name: "{{ .SiteURL }}", desc: "Website URL" },
      { name: "{{ .Email }}", desc: "Invited member email" },
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GeFlow Invitation</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0c0f17; color: #f1f5f9; }
    .container { max-width: 580px; margin: 40px auto; background: #131825; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; }
    .header { padding: 36px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo-text { font-size: 26px; font-weight: 800; color: #ffffff; text-decoration: none; }
    .logo-accent { color: #38bdf8; }
    .content { padding: 36px 40px; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 12px; }
    .desc { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 28px; }
    .btn { display: inline-block; background: #38bdf8; color: #041017 !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; }
    .footer { padding: 24px 40px 36px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">Ge<span class="logo-accent">Flow</span></div>
    </div>
    
    <div class="content">
      <h1 class="title">You're Invited!</h1>
      <p class="desc">
        You have been invited to collaborate on a GeFlow business workspace. Click below to accept the invitation and set up your profile:
      </p>

      <div>
        <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">
          🤝 Accept Team Invitation
        </a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0;">GeFlow Team Collaboration • gepardwebs@gmail.com</p>
    </div>
  </div>
</body>
</html>`,
  },
];
