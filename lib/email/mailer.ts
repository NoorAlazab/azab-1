import nodemailer from 'nodemailer';

// Create transporter using SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions) {
  const mailOptions = {
    from: process.env.MAIL_FROM!,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// Test the connection (optional, for debugging)
export async function testConnection() {
  try {
    await transporter.verify();
    console.log('SMTP connection is ready');
    return true;
  } catch (error) {
    console.error('SMTP connection failed:', error);
    return false;
  }
}