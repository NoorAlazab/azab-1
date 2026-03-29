// Test script to simulate adding a manual test case
const fetch = require('node-fetch');

async function testManualTestCase() {
  const testCase = {
    id: `case-${Date.now()}-test`,
    title: "Manual Test: Verify user can create a ticket",
    description: "Test case to verify user can create a support ticket manually",
    type: "functional",
    priority: "P1",
    preconditions: ["User is logged in", "System is accessible"],
    steps: [
      { action: "Navigate to create ticket page", expected: "Page loads successfully" },
      { action: "Fill in ticket details", expected: "Form accepts input" },
      { action: "Click submit", expected: "Ticket is created" }
    ],
    expected: "User can successfully create a support ticket",
    tags: []
  };

  console.log('=== SIMULATING MANUAL TEST CASE ADDITION ===');
  console.log('Test case to add:', JSON.stringify(testCase, null, 2));

  try {
    const response = await fetch('http://localhost:3001/api/generator/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'test-token' // This will fail but we can see the request
      },
      body: JSON.stringify({
        suiteId: 'cmgneuj7x0003jz4spdwi87ba', // SCRUM-18 suite ID
        story: {
          summary: 'SCRUM-18 Manual Test',
          descriptionText: 'Testing manual test case addition',
          acceptanceCriteriaText: 'User should be able to add manual test cases'
        },
        mode: 'append',
        cases: [testCase]
      })
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response:', responseText);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testManualTestCase();