interface VerifyEmailParams {
  verifyUrl: string;
  appName: string;
  userEmail: string;
}

export function renderVerifyEmail({ verifyUrl, appName, userEmail }: VerifyEmailParams): { subject: string; text: string; html: string } {
  const subject = `Verify your ${appName} account`;
  
  const text = `
Hello,

Thank you for signing up for ${appName}!

To complete your account setup, please verify your email address by clicking the link below:

${verifyUrl}

This verification link will expire in 24 hours.

If you didn't create an account with ${appName}, you can safely ignore this email.

Best regards,
The ${appName} Team
`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Account</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .main-content {
            background-color: #f8fafc;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .verify-button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
        }
        .verify-button:hover {
            background-color: #1d4ed8;
        }
        .fallback-link {
            background-color: #e5e7eb;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
            word-break: break-all;
        }
        .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-top: 30px;
        }
        .expiry-note {
            color: #dc2626;
            font-size: 14px;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">${appName}</div>
        <h1>Verify Your Email Address</h1>
    </div>
    
    <div class="main-content">
        <p>Hello,</p>
        
        <p>Thank you for signing up for <strong>${appName}</strong>!</p>
        
        <p>To complete your account setup and start using all features, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
            <a href="${verifyUrl}" class="verify-button" rel="noopener noreferrer">Verify Email Address</a>
        </div>
        
        <p class="expiry-note">⚠️ This verification link will expire in 24 hours.</p>
        
        <div class="fallback-link">
            <p><strong>If the button doesn't work, copy and paste this link into your browser:</strong></p>
            <p><a href="${verifyUrl}" rel="noopener noreferrer">${verifyUrl}</a></p>
        </div>
    </div>
    
    <div class="footer">
        <p>If you didn't create an account with ${appName}, you can safely ignore this email.</p>
        <p>This email was sent to ${userEmail}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p>Best regards,<br>The ${appName} Team</p>
    </div>
</body>
</html>
`;

  return { subject, text, html };
}