/**
 * Test Jira Connection Issue
 * This script helps debug the "Connect Jira" button functionality
 */

console.log('🔧 Testing Jira Connection Button Functionality');
console.log('===============================================\n');

// Test the PKCE start endpoint
async function testJiraConnection() {
  try {
    console.log('1. Testing /api/auth/atlassian/pkce/start endpoint...');
    
    const response = await fetch('http://localhost:3000/api/auth/atlassian/pkce/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'qacf_session=' // This would normally contain the session
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ PKCE endpoint is working');
      console.log('Authorization URL:', data.authorizeUrl);
    } else {
      console.log('❌ PKCE endpoint failed');
      console.log('Error:', data.error);
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

async function checkEnvironment() {
  console.log('\n2. Checking environment configuration...');
  
  // Check if all required env vars are set
  require('dotenv').config({ path: '.env.local' });
  
  const requiredVars = [
    'ATLASSIAN_CLIENT_ID',
    'ATLASSIAN_REDIRECT_URI',
    'APP_URL',
    'SESSION_SECRET'
  ];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${varName === 'SESSION_SECRET' ? '***HIDDEN***' : value}`);
    } else {
      console.log(`❌ ${varName}: Not set`);
    }
  });
}

async function main() {
  await checkEnvironment();
  await testJiraConnection();
  
  console.log('\n🔍 Diagnosis:');
  console.log('If you see AUTH_REQUIRED error, the user needs to be logged in first');
  console.log('If you see environment errors, check your .env.local file');
  console.log('If you see network errors, make sure the dev server is running on port 3001');
  
  console.log('\n🚀 Next steps:');
  console.log('1. Make sure you are logged in (visit /signup or /login)');
  console.log('2. Visit /dashboard and try clicking "Connect Jira"');
  console.log('3. Check browser developer tools for any JavaScript errors');
}

main().catch(console.error);