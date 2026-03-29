// Simple API test script
const testAPI = async () => {
  console.log('🧪 Testing Test Suite APIs...\n');

  // Test 1: Check if server is running
  try {
    const response = await fetch('http://localhost:3000/api/auth/check');
    const data = await response.json();
    console.log('✅ Server is running');
    console.log('   Endpoints available:', Object.keys(data.endpoints || {}));
    
    // Test if draft endpoint is listed
    if (data.endpoints?.draft) {
      console.log('✅ Draft API endpoint is registered');
    } else {
      console.log('❌ Draft API endpoint not found');
      return;
    }
  } catch (error) {
    console.log('❌ Server not running:', error.message);
    return;
  }

  console.log('\n🎯 All systems ready for testing!');
  console.log('\nNext steps:');
  console.log('1. Open http://localhost:3000/test-api.html for interactive testing');
  console.log('2. Open http://localhost:3000/generator for the main UI');
  console.log('3. Open http://localhost:3000/test-generator for debug UI');
  
  console.log('\n📋 Available APIs:');
  console.log('- POST /api/generator/draft - Generate test cases');
  console.log('- POST /api/generator/suite - Create/load test suite');
  console.log('- POST /api/generator/case - CRUD test cases');  
  console.log('- POST /api/jira/publish - Publish to Jira');
  console.log('- GET  /api/generator/test - Health check');
};

testAPI().catch(console.error);