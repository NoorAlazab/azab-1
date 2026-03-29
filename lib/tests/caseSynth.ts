import type { SynthesizedCase } from "@/types/exploration";
import { loadSelectorMapping } from '@/lib/exploration/selectorRepository';

export interface SynthInput {
  summary: string;
  description?: string;
  acceptanceCriteria?: string;
  environmentUrl?: string; // Optional: for loading selector context
  pageName?: string; // Optional: specific page to load selectors for
}

/**
 * Synthesize test cases from story information
 * Uses LLM if API key available, falls back to heuristics
 */
export async function synthesizeCases(
  input: SynthInput
): Promise<SynthesizedCase[]> {
  // Try LLM first if API key is available
  if (process.env.GROQ_API_KEY) {
    try {
      return await synthesizeCasesWithLLM(input);
    } catch (error) {
      console.error("LLM synthesis failed, falling back to heuristics:", error);
    }
  }

  // Fallback to heuristics
  return synthesizeCasesWithHeuristics(input);
}

/**
 * LLM-based test case synthesis using Groq
 */
async function synthesizeCasesWithLLM(
  input: SynthInput
): Promise<SynthesizedCase[]> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  // Try to load selector context if environment/page provided
  let selectorContext = '';
  if (input.environmentUrl || input.pageName) {
    try {
      const pageName = input.pageName || derivePageFromUrl(input.environmentUrl || '');
      const environmentSlug = input.environmentUrl ? urlToSlug(input.environmentUrl) : undefined;

      const mapping = await loadSelectorMapping(pageName, environmentSlug);
      if (mapping && mapping.elements) {
        const elementKeys = Object.keys(mapping.elements);
        if (elementKeys.length > 0) {
          selectorContext = `\n\n🎯 AVAILABLE ELEMENT KEYS FOR THIS PAGE:\nYou MUST ONLY use these exact element keys in your test steps:\n${elementKeys.map(key => `- \`${key}\``).join('\n')}\n\nDO NOT invent element keys - ONLY use the ones listed above!\n`;
        }
      }
    } catch (error) {
      // Selector loading is optional - don't fail if it doesn't work
      console.debug('Could not load selector context, using naming patterns instead');
    }
  }

  const prompt = `You are an expert QA automation engineer. Generate 5-8 precise, executable test cases for this user story.${selectorContext}

Story Summary: ${input.summary}
${input.description ? `Description: ${input.description}` : ""}
${input.acceptanceCriteria ? `Acceptance Criteria: ${input.acceptanceCriteria}` : ""}

CRITICAL STEP FORMATTING RULES:
1. For navigation: Use "Navigate to /path" format (e.g., "Navigate to /login", "Navigate to /dashboard")
2. For clicking: ALWAYS use "Click \`elementKey\`" format with backticks
   - NEVER use natural language like "Click 'Sign In'" or "Click the button"
   - ALWAYS wrap element keys in backticks: \`buttonSignin\`, \`buttonSubmit\`
   - Element keys follow pattern: button*, input*, link* in camelCase
3. For filling: ALWAYS use "Enter 'value' in \`elementKey\`" format
   - NEVER use "in the email field" - use \`inputEmail\` instead
   - Examples: "Enter 'test@example.com' in \`inputEmail\`"
4. For waiting: Use "Wait for page load" or "Wait for element to appear"
5. For verification: Use "Verify text-to-check is displayed" or "Verify URL is /expected-path"
   - For element verification: "Verify \`elementKey\` is displayed"

ELEMENT KEY NAMING PATTERNS:
- Buttons: \`buttonSignin\`, \`buttonSubmit\`, \`buttonCancel\`, \`buttonSave\`
- Inputs: \`inputEmail\`, \`inputPassword\`, \`inputUsername\`, \`inputSearch\`
- Links: \`linkForgotPassword\`, \`linkSignup\`, \`linkHome\`
- Use camelCase, start with element type (button/input/link)

IMPORTANT GUIDELINES:
- Each step must be specific and actionable
- Use exact URLs with leading slash: /login, /dashboard, /profile
- ALWAYS use backtick notation for UI elements
- NEVER use natural language element descriptions
- Include both positive and negative test scenarios
- Steps must be parseable by automation

For each test case, provide:
- title: Clear test case name starting with "Verify" or "Test"
- steps: Array of 4-8 steps following the formatting rules above
- expected: Specific, measurable expected outcome
- priority: P0 (critical) | P1 (high) | P2 (medium) | P3 (low)

Respond ONLY with a valid JSON array, no markdown formatting.

GOOD example (USE BACKTICKS FOR ALL ELEMENTS):
[
  {
    "title": "Verify successful login with valid credentials",
    "steps": [
      "Navigate to /login",
      "Enter 'user@example.com' in \`inputEmail\`",
      "Enter 'ValidPassword123' in \`inputPassword\`",
      "Click \`buttonSignin\`",
      "Wait for page load",
      "Verify URL is /dashboard",
      "Verify 'Welcome' is displayed"
    ],
    "expected": "User logs in and sees dashboard",
    "priority": "P0"
  }
]

BAD example (NEVER DO THIS):
{
  "title": "Login test",
  "steps": [
    "Navigate to the login page",         ← BAD: Use "Navigate to /login"
    "Enter 'user' in the email field",    ← BAD: Use \`inputEmail\` not "email field"
    "Click 'Sign In'",                    ← BAD: Use \`buttonSignin\` not 'Sign In'
    "Press the submit button"             ← BAD: Use \`buttonSubmit\` not "the submit button"
  ]
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || "[]";

  // Parse the JSON response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not extract JSON array from LLM response");
  }

  const cases = JSON.parse(jsonMatch[0]) as SynthesizedCase[];
  return cases;
}

/**
 * Heuristic-based test case synthesis
 */
function synthesizeCasesWithHeuristics(
  input: SynthInput
): SynthesizedCase[] {
  const summary = input.summary.toLowerCase();
  const description = (input.description || "").toLowerCase();
  const ac = (input.acceptanceCriteria || "").toLowerCase();
  const allText = `${summary} ${description} ${ac}`;

  const cases: SynthesizedCase[] = [];

  // Detect common patterns
  const isAuth = /login|sign.?in|auth|password|credential/.test(allText);
  const isForm = /form|input|submit|create|add|register/.test(allText);
  const isRename = /rename|change.*to|replace|update.*name|text.*change/.test(
    allText
  );
  const isDelete = /delete|remove/.test(allText);
  const isValidation = /validat|error|invalid|require/.test(allText);
  const isNavigation = /navigat|redirect|route|page/.test(allText);
  const isUI = /button|link|label|text|display|show|hide/.test(allText);

  // Generate cases based on detected patterns

  if (isRename || isUI) {
    // UI text change
    cases.push({
      title: "Verify UI element displays updated text content",
      steps: [
        "Navigate to the relevant page in the application",
        "Wait for page to fully load",
        "Locate the specific UI element (button, label, link, or heading)",
        "Inspect the displayed text content",
        "Verify the text matches the expected new value",
        "Check that formatting and styling are preserved",
      ],
      expected: "UI element displays the new text exactly as specified in requirements with correct styling",
      priority: "P1",
    });
  }

  if (isAuth) {
    cases.push(
      {
        title: "Verify successful login with valid credentials",
        steps: [
          "Navigate to /login",
          "Wait for page load",
          "Enter 'testuser@example.com' in the email field",
          "Enter 'ValidPassword123' in the password field",
          "Click 'Sign In'",
          "Wait for page load",
          "Verify URL is /dashboard",
          "Verify 'Welcome' is displayed",
        ],
        expected: "User successfully authenticates and is redirected to the dashboard",
        priority: "P0",
      },
      {
        title: "Verify login fails with invalid credentials",
        steps: [
          "Navigate to /login",
          "Wait for page load",
          "Enter 'invalid@example.com' in the email field",
          "Enter 'WrongPassword' in the password field",
          "Click 'Sign In'",
          "Wait for page load",
          "Verify 'Invalid credentials' is displayed",
          "Verify URL is /login",
        ],
        expected: "Authentication fails with error message, user stays on login page",
        priority: "P1",
      }
    );
  }

  if (isForm) {
    cases.push(
      {
        title: "Verify form submission with valid data",
        steps: [
          "Navigate to form page",
          "Fill all required fields with valid data",
          "Click submit button",
        ],
        expected: "Form is submitted successfully and confirmation is shown",
        priority: "P0",
      },
      {
        title: "Verify form validation for required fields",
        steps: [
          "Navigate to form page",
          "Leave required fields empty",
          "Attempt to submit",
        ],
        expected: "Validation errors are shown for required fields",
        priority: "P1",
      }
    );
  }

  if (isValidation) {
    cases.push({
      title: "Verify input validation rules",
      steps: [
        "Navigate to input page",
        "Enter invalid data (empty, wrong format, etc.)",
        "Attempt to proceed",
      ],
      expected: "Appropriate validation error messages are displayed",
      priority: "P1",
    });
  }

  if (isNavigation) {
    cases.push({
      title: "Verify navigation to expected page",
      steps: [
        "Start from initial page",
        "Click navigation element",
        "Verify URL and page content",
      ],
      expected: "User is navigated to the correct page",
      priority: "P1",
    });
  }

  if (isDelete) {
    cases.push({
      title: "Verify delete operation",
      steps: [
        "Navigate to item list",
        "Select item to delete",
        "Confirm deletion",
        "Verify item is removed",
      ],
      expected: "Item is deleted and no longer appears in the list",
      priority: "P0",
    });
  }

  // Only add generic cases if we have some specific context
  // Otherwise, the quality score will be too low anyway
  if (cases.length === 0) {
    // No patterns detected - suggest using AI or adding more details
    cases.push({
      title: "Story needs more details for concrete test generation",
      steps: [
        "Add acceptance criteria to the story",
        "Include specific UI elements, paths, or expected behaviors",
        "Re-run analysis with updated story information",
      ],
      expected: "Concrete test objectives can be generated from detailed acceptance criteria",
      priority: "P0",
    });
  }

  return cases.slice(0, 8); // Limit to 8 cases max
}

/**
 * Helper: Derive page name from URL path
 * Examples: /login -> login, /dashboard -> dashboard
 */
function derivePageFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    if (!path) return 'home';
    // Take first segment as page name
    return path.split('/')[0] || 'home';
  } catch {
    return 'home';
  }
}

/**
 * Helper: Convert URL to slug for environment identification
 * Examples: https://staging.example.com -> staging-example-com
 */
function urlToSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/\./g, '-');
  } catch {
    return url.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  }
}
