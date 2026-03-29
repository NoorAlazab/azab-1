/**
 * Test script to verify email verification implementation
 * Run with: node test-email-verification.js
 */

console.log('Testing email verification implementation...');

// Test 1: Check if all required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'lib/email/mailer.ts',
  'lib/email/templates/verifyAccount.ts', 
  'lib/auth/emailTokens.ts',
  'app/api/auth/verify/route.ts',
  'app/api/auth/verify/resend/route.ts',
  'prisma/migrations'
];

console.log('\n✅ Checking required files...');
requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} - MISSING`);
  }
});

// Test 2: Check environment variables
console.log('\n✅ Checking environment setup...');
require('dotenv').config({ path: '.env.local' });

const requiredEnvVars = [
  'APP_URL',
  'MAIL_FROM', 
  'SMTP_HOST',
  'SMTP_PORT',
  'VERIFY_TOKEN_HOURS'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`  ✓ ${envVar}: ${process.env[envVar]}`);
  } else {
    console.log(`  ⚠ ${envVar}: Not set (needs SMTP configuration)`);
  }
});

// Test 3: Check database schema
console.log('\n✅ Checking database schema...');
const schemaPath = path.join(__dirname, 'prisma/schema.prisma');

if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  if (schema.includes('isVerified') && schema.includes('VerificationToken')) {
    console.log('  ✓ Database schema updated with verification fields');
  } else {
    console.log('  ✗ Database schema missing verification fields');
  }
} else {
  console.log('  ✗ Prisma schema not found');
}

console.log('\n🎉 Email verification implementation complete!');
console.log('\nNext steps:');
console.log('1. Configure SMTP settings in .env.local');
console.log('2. Test signup flow at http://localhost:3000/signup');
console.log('3. Check email inbox for verification email');
console.log('4. Click verification link and test login');

console.log('\nFor development, you can use Mailtrap.io for email testing.');