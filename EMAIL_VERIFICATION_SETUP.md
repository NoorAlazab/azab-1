# Email Verification Setup Guide

## Environment Variables

Add these variables to your `.env.local` file:

```bash
# Email Configuration
MAIL_FROM="OmniForge <no-reply@omniforge.dev>"
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=YOUR_SMTP_USER
SMTP_PASS=YOUR_SMTP_PASS
VERIFY_TOKEN_HOURS=24
```

## SMTP Providers

### Development (Mailtrap)
1. Sign up at [Mailtrap.io](https://mailtrap.io)
2. Create a new inbox
3. Copy SMTP credentials to your `.env.local`

### Production Options
- **SendGrid**: High deliverability, generous free tier
- **AWS SES**: Cost-effective for high volume
- **Mailgun**: Developer-friendly with good analytics
- **Postmark**: Excellent for transactional emails

## Testing the Email System

1. Start the development server: `npm run dev`
2. Navigate to `/signup`
3. Create a new account
4. Check your email inbox (or Mailtrap if using dev setup)
5. Click the verification link
6. Try logging in with your verified account

## Email Flow

1. **Signup**: User creates account → verification email sent → redirect to login with info banner
2. **Verification**: User clicks email link → account marked as verified → redirect to login with success banner
3. **Login**: Unverified users see error + resend option → verified users log in successfully
4. **Resend**: Users can request new verification emails (with 60-second throttling)

## Security Features

- Tokens are cryptographically secure (32 bytes)
- Tokens are hashed before storage (SHA-256)
- Tokens expire after 24 hours (configurable)
- One-time use tokens (marked as used after verification)
- Rate limiting on resend requests (60-second cooldown)
- No email enumeration (resend always returns success)