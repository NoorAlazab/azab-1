// Debug script to test what generateCases returns
import { generateCasesAI } from './generateCases';

const testInput = {
  summary: "Test login functionality",
  description: "User should be able to log in",
  ac: "Given valid credentials, user logs in successfully"
};

async function testGeneration() {
  console.log("Testing AI generation...");
  const result = await generateCasesAI(testInput);
  console.log("Result:", JSON.stringify(result, null, 2));
  
  if (result && result[0]) {
    console.log("First test case steps structure:", typeof result[0].steps);
    console.log("First test case steps:", result[0].steps);
    if (result[0].steps && result[0].steps[0]) {
      console.log("First step type:", typeof result[0].steps[0]);
      console.log("First step:", result[0].steps[0]);
    }
  }
}

testGeneration().catch(console.error);