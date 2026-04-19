/**
 * Prompt builder for AI test-case generation.
 *
 * Extracted out of `lib/ai/generateCases.ts` so:
 *   - the prompt itself is greppable / diff-friendly without scrolling
 *     past parsing & error-handling code
 *   - the prompt can be unit-tested independently (assert that toggling
 *     coverage types or adding selector context produces the right text)
 *   - future variants (different models, different domains) only have to
 *     swap the builder, not duplicate hundreds of lines of API plumbing.
 */

export type CoverageType =
  | "functional"
  | "negative"
  | "boundary"
  | "accessibility"
  | "security"
  | "performance";

export type PromptInput = {
  summary: string;
  description?: string;
  ac?: string;
  coverageTypes: string[];
  maxCases: number;
  selectorContext?: string;
};

export function buildGenerateCasesPrompt(input: PromptInput): string {
  const { summary, description, ac, coverageTypes, maxCases } = input;
  const selectorContext = input.selectorContext ?? "";

  const types = coverageTypes.join(", ");
  const typesAnd = coverageTypes.join(" AND ");
  const typesOr = coverageTypes.join(" OR ");

  return `You are a senior QA engineer with 10+ years of experience in test case design and execution. Generate exactly ${maxCases} detailed, professional test cases for the following user story.${selectorContext}

CRITICAL REQUIREMENTS:
- Use action-oriented language starting with "Verify that...", "Ensure that...", "Confirm that..."
- Each test case must be atomic (test one specific functionality)
- Follow industry-standard test case structure
- Base tests STRICTLY on provided requirements - no assumptions
- Focus specifically on the selected coverage types below

Story Requirements:
Title: ${summary}
Description: ${description || "No description provided"}
Acceptance Criteria: ${ac || "No acceptance criteria provided"}

CRITICAL INSTRUCTION - READ THIS CAREFULLY:
YOU MUST GENERATE TEST CASES SPECIFICALLY FOR THE STORY TITLED "${summary}".
DO NOT GENERATE GENERIC LOGIN OR AUTHENTICATION TESTS UNLESS THE STORY IS EXPLICITLY ABOUT LOGIN/AUTHENTICATION.
ANALYZE THE STORY TITLE AND DESCRIPTION TO UNDERSTAND WHAT FUNCTIONALITY IS BEING TESTED.
IF THE STORY TITLE IS JUST A NAME OR UNCLEAR, ASK YOURSELF: "What would a user story called '${summary}' actually test?"

YOU MUST GENERATE EXACTLY ${maxCases} TEST CASES OF TYPE: ${typesAnd}

SELECTED COVERAGE TYPE: ${types}

${coverageTypes.includes("negative") ? `
NEGATIVE TESTS ONLY - MANDATORY REQUIREMENTS:
- Test INVALID inputs, error conditions, failure scenarios
- Test what happens when things go WRONG
- Test boundary violations, invalid data, unauthorized access
- Test system behavior under stress or incorrect usage
- Examples: Invalid login credentials, empty required fields, expired tokens
- Set "type": "negative" for ALL test cases
- DO NOT test normal happy path scenarios
` : ""}

${coverageTypes.includes("functional") ? `
FUNCTIONAL TESTS ONLY - MANDATORY REQUIREMENTS:
- Test normal business logic and user workflows
- Test core features working correctly
- Test successful user scenarios and happy paths
- Examples: Successful login, valid form submission, correct calculations
- Set "type": "functional" for ALL test cases
` : ""}

${coverageTypes.includes("performance") ? `
PERFORMANCE TESTS ONLY - MANDATORY REQUIREMENTS:
- Test load times, response times, scalability
- Test system performance under various loads
- Test memory usage, concurrent users, throughput
- Examples: Page load under 2 seconds, handles 1000 concurrent users
- Set "type": "performance" for ALL test cases
` : ""}

${coverageTypes.includes("security") ? `
SECURITY TESTS ONLY - MANDATORY REQUIREMENTS:
- Test authentication, authorization, data protection
- Test for security vulnerabilities (SQL injection, XSS, etc.)
- Test access controls and permission systems
- Examples: Unauthorized access attempts, input sanitization
- Set "type": "security" for ALL test cases
` : ""}

CONTEXT ANALYSIS REQUIREMENTS:
- Read the story title "${summary}" carefully - what functionality does this suggest?
- If the story title is unclear or just a name, base tests on the description and acceptance criteria
- DO NOT default to login/authentication tests unless explicitly mentioned in the story
- Focus on the actual functionality being developed in this story

Quality Standards:
- Use specific, measurable expected results
- Include exact UI element names and locations
- Specify error messages that should appear
- Test data should be realistic and varied
- Steps should be executable by any QA engineer
- Test cases must be relevant to the story title "${summary}"

Priority Levels:
- Critical: System breaking functionality, security issues, data corruption
- High: Major features, core business functionality, user blocking issues
- Medium: Standard functionality, moderate business impact, workaround available
- Low: Nice-to-have features, cosmetic issues, minor enhancements

ELEMENT REFERENCE FORMAT
ALWAYS use backtick notation \`elementKey\` for ALL UI elements in test steps.

ELEMENT KEY NAMING PATTERNS (MUST FOLLOW):
- Buttons: \`buttonSignin\`, \`buttonSubmit\`, \`buttonCancel\`, \`buttonSave\`, \`buttonLogin\`
- Input fields: \`inputEmail\`, \`inputPassword\`, \`inputUsername\`, \`inputSearch\`
- Links: \`linkForgotPassword\`, \`linkSignup\`, \`linkHome\`, \`linkLogin\`
- Format: {type}{Name} in camelCase (e.g., button + Signin = buttonSignin)

MANDATORY ACTION FORMATS:
CORRECT: "Click \`buttonSubmit\`"
CORRECT: "Enter 'test@example.com' in \`inputEmail\`"
CORRECT: "Click \`linkForgotPassword\`"

WRONG: "Click 'Submit'" (NO quotes around button text)
WRONG: "Click the submit button" (NO natural language)
WRONG: "Enter email in the email field" (NO "the field" language)
WRONG: "Click Submit" (MUST have backticks)

Test Case Structure:
{
  "id": "TC001",
  "title": "Verify [specific functionality being tested]",
  "description": "Brief description of what this test validates",
  "preconditions": ["System prerequisite 1", "User state requirement"],
  "steps": [
    {"action": "Navigate to /login", "expected": "Login page loads successfully"},
    {"action": "Enter 'test@example.com' in \`inputEmail\`", "expected": "Email is accepted and field validates"},
    {"action": "Enter 'ValidPassword123' in \`inputPassword\`", "expected": "Password is masked and accepted"},
    {"action": "Click \`buttonSignin\`", "expected": "Form submits and user is redirected"}
  ],
  "expected": "Overall expected outcome of the complete test",
  "priority": "Critical|High|Medium|Low",
  "type": "functional|negative|boundary|accessibility|security|performance|smoke|regression|integration"
}

FINAL VALIDATION - Before returning, ensure:
1. ALL test cases have "type" field matching ONLY: ${typesOr}
2. NO test cases with other types (like "smoke", "regression", "integration")
3. Test content matches the selected type (performance tests should test performance, not functionality)
4. Exactly ${maxCases} test cases generated

Return ONLY a valid JSON array of test case objects following this exact structure.`;
}

/**
 * Build the optional selector-context block that pins the model to a known
 * vocabulary of element keys when an environment+page is known.
 */
export function buildSelectorContext(
  pageName: string,
  elements: Record<string, { metadata?: { description?: string } }>,
): string {
  const keys = Object.keys(elements);
  if (keys.length === 0) return "";
  return `\n\nAVAILABLE ELEMENT KEYS FOR ${pageName.toUpperCase()} PAGE:
You MUST ONLY use these exact element keys in your test steps:
${keys.map((key) => `- \`${key}\` (${elements[key].metadata?.description || "no description"})`).join("\n")}

DO NOT invent element keys - ONLY use the ones listed above.
If you need an element not in this list, use descriptive natural language and fuzzy matching will handle it.
`;
}
