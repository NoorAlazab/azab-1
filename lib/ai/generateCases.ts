import { log } from '@/lib/utils/logger';
import { loadSelectorMapping } from '@/lib/exploration/selectorRepository';

type Input = {
  summary: string;
  description?: string;
  ac?: string;
  coverage?: string;
  maxCases?: number;
  environmentUrl?: string; // Optional: for loading selector context
  pageName?: string; // Optional: specific page to load selectors for
};

type GeneratedTestCase = {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  steps: { action: string; expected: string }[];
  expected: string;
  priority: "P0" | "P1" | "P2" | "P3";
  type: "functional" | "negative" | "boundary" | "accessibility" | "security" | "performance";
  tags: string[];
};

export async function generateCasesAI(input: Input): Promise<GeneratedTestCase[]> {
  log.debug('AI generation called', { module: 'GenerateCases', summary: input.summary?.substring(0, 50) });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    log.debug('No Groq API key found, using stub cases', { module: 'GenerateCases' });
    return stubCases(input);
  }

  const max = Math.min(Math.max(input.maxCases ?? 8, 3), 20);

  const coverageTypes = input.coverage ? input.coverage.split(',').map(c => c.trim()) : ['functional'];

  // Try to load selector context if environment/page provided
  let selectorContext = '';
  if (input.environmentUrl || input.pageName) {
    try {
      const pageName = input.pageName || derivePageFromUrl(input.environmentUrl || '');
      const environmentSlug = input.environmentUrl ? urlToSlug(input.environmentUrl) : undefined;

      log.debug('Attempting to load selector context', {
        module: 'GenerateCases',
        pageName,
        environmentSlug
      });

      const mapping = await loadSelectorMapping(pageName, environmentSlug);
      if (mapping && mapping.elements) {
        const elementKeys = Object.keys(mapping.elements);
        if (elementKeys.length > 0) {
          selectorContext = `\n\n🎯 AVAILABLE ELEMENT KEYS FOR ${pageName.toUpperCase()} PAGE:\nYou MUST ONLY use these exact element keys in your test steps:\n${elementKeys.map(key => `- \`${key}\` (${mapping.elements[key].metadata?.description || 'no description'})`).join('\n')}\n\nDO NOT invent element keys - ONLY use the ones listed above!\nIf you need an element not in this list, use descriptive natural language and fuzzy matching will handle it.\n`;

          log.info('Loaded selector context for AI', {
            module: 'GenerateCases',
            pageName,
            elementCount: elementKeys.length
          });
        }
      } else {
        log.debug('No selector mapping found', { module: 'GenerateCases', pageName, environmentSlug });
      }
    } catch (error) {
      // Selector loading is optional - don't fail if it doesn't work
      log.debug('Could not load selector context, using naming patterns instead', {
        module: 'GenerateCases',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  const getCoverageInstructions = (types: string[]) => {
    const instructions: string[] = [];
    
    if (types.includes('functional')) {
      instructions.push('✅ FUNCTIONAL tests ONLY: Core business logic, user workflows, feature functionality. Set "type": "functional" for ALL tests.');
    }
    if (types.includes('negative')) {
      instructions.push('✅ NEGATIVE tests ONLY: Invalid inputs, error conditions, failure scenarios. Set "type": "negative" for ALL tests.');
    }
    if (types.includes('boundary')) {
      instructions.push('✅ BOUNDARY tests ONLY: Minimum/maximum values, limits, edge values, thresholds. Set "type": "boundary" for ALL tests.');
    }
    if (types.includes('accessibility')) {
      instructions.push('✅ ACCESSIBILITY tests ONLY: Screen readers, keyboard navigation, WCAG compliance, color contrast. Set "type": "accessibility" for ALL tests.');
    }
    if (types.includes('security')) {
      instructions.push('✅ SECURITY tests ONLY: Authentication, authorization, data protection, SQL injection, XSS. Set "type": "security" for ALL tests.');
    }
    if (types.includes('performance')) {
      instructions.push('✅ PERFORMANCE tests ONLY: Load times, response times, scalability, memory usage, concurrent users. Set "type": "performance" for ALL tests.');
    }
    
    return instructions.length > 0 ? instructions : ['✅ FUNCTIONAL tests ONLY: Core business logic, user workflows, feature functionality. Set "type": "functional" for ALL tests.'];
  };

  const prompt = `You are a senior QA engineer with 10+ years of experience in test case design and execution. Generate exactly ${max} detailed, professional test cases for the following user story.${selectorContext}

CRITICAL REQUIREMENTS:
- Use action-oriented language starting with "Verify that...", "Ensure that...", "Confirm that..."
- Each test case must be atomic (test one specific functionality)
- Follow industry-standard test case structure
- Base tests STRICTLY on provided requirements - no assumptions
- Focus specifically on the selected coverage types below

Story Requirements:
Title: ${input.summary}
Description: ${input.description || 'No description provided'}
Acceptance Criteria: ${input.ac || 'No acceptance criteria provided'}

CRITICAL INSTRUCTION - READ THIS CAREFULLY:
YOU MUST GENERATE TEST CASES SPECIFICALLY FOR THE STORY TITLED "${input.summary}".
DO NOT GENERATE GENERIC LOGIN OR AUTHENTICATION TESTS UNLESS THE STORY IS EXPLICITLY ABOUT LOGIN/AUTHENTICATION.
ANALYZE THE STORY TITLE AND DESCRIPTION TO UNDERSTAND WHAT FUNCTIONALITY IS BEING TESTED.
IF THE STORY TITLE IS JUST A NAME OR UNCLEAR, ASK YOURSELF: "What would a user story called '${input.summary}' actually test?"

YOU MUST GENERATE EXACTLY ${max} TEST CASES OF TYPE: ${coverageTypes.join(' AND ')}

SELECTED COVERAGE TYPE: ${coverageTypes.join(', ')}

${coverageTypes.includes('negative') ? `
🚨 NEGATIVE TESTS ONLY - MANDATORY REQUIREMENTS:
- Test INVALID inputs, error conditions, failure scenarios
- Test what happens when things go WRONG
- Test boundary violations, invalid data, unauthorized access
- Test system behavior under stress or incorrect usage
- Examples: Invalid login credentials, empty required fields, expired tokens
- Set "type": "negative" for ALL test cases
- DO NOT test normal happy path scenarios
` : ''}

${coverageTypes.includes('functional') ? `
🚨 FUNCTIONAL TESTS ONLY - MANDATORY REQUIREMENTS:
- Test normal business logic and user workflows
- Test core features working correctly
- Test successful user scenarios and happy paths  
- Examples: Successful login, valid form submission, correct calculations
- Set "type": "functional" for ALL test cases
` : ''}

${coverageTypes.includes('performance') ? `
🚨 PERFORMANCE TESTS ONLY - MANDATORY REQUIREMENTS:
- Test load times, response times, scalability
- Test system performance under various loads
- Test memory usage, concurrent users, throughput
- Examples: Page load under 2 seconds, handles 1000 concurrent users
- Set "type": "performance" for ALL test cases
` : ''}

${coverageTypes.includes('security') ? `
🚨 SECURITY TESTS ONLY - MANDATORY REQUIREMENTS:
- Test authentication, authorization, data protection
- Test for security vulnerabilities (SQL injection, XSS, etc.)
- Test access controls and permission systems
- Examples: Unauthorized access attempts, input sanitization
- Set "type": "security" for ALL test cases
` : ''}

CONTEXT ANALYSIS REQUIREMENTS:
- Read the story title "${input.summary}" carefully - what functionality does this suggest?
- If the story title is unclear or just a name, base tests on the description and acceptance criteria
- DO NOT default to login/authentication tests unless explicitly mentioned in the story
- Focus on the actual functionality being developed in this story

Quality Standards:
- Use specific, measurable expected results
- Include exact UI element names and locations
- Specify error messages that should appear
- Test data should be realistic and varied
- Steps should be executable by any QA engineer
- Test cases must be relevant to the story title "${input.summary}"

Priority Levels:
- Critical: System breaking functionality, security issues, data corruption
- High: Major features, core business functionality, user blocking issues
- Medium: Standard functionality, moderate business impact, workaround available
- Low: Nice-to-have features, cosmetic issues, minor enhancements

🚨 CRITICAL: ELEMENT REFERENCE FORMAT 🚨
ALWAYS use backtick notation \`elementKey\` for ALL UI elements in test steps!

ELEMENT KEY NAMING PATTERNS (MUST FOLLOW):
- Buttons: \`buttonSignin\`, \`buttonSubmit\`, \`buttonCancel\`, \`buttonSave\`, \`buttonLogin\`
- Input fields: \`inputEmail\`, \`inputPassword\`, \`inputUsername\`, \`inputSearch\`
- Links: \`linkForgotPassword\`, \`linkSignup\`, \`linkHome\`, \`linkLogin\`
- Format: {type}{Name} in camelCase (e.g., button + Signin = buttonSignin)

MANDATORY ACTION FORMATS:
✅ CORRECT: "Click \`buttonSubmit\`"
✅ CORRECT: "Enter 'test@example.com' in \`inputEmail\`"
✅ CORRECT: "Click \`linkForgotPassword\`"

❌ WRONG: "Click 'Submit'" (NO quotes around button text!)
❌ WRONG: "Click the submit button" (NO natural language!)
❌ WRONG: "Enter email in the email field" (NO "the field" language!)
❌ WRONG: "Click Submit" (MUST have backticks!)

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
1. ALL test cases have "type" field matching ONLY: ${coverageTypes.join(' OR ')}
2. NO test cases with other types (like "smoke", "regression", "integration") 
3. Test content matches the selected type (performance tests should test performance, not functionality)
4. Exactly ${max} test cases generated

Return ONLY a valid JSON array of test case objects following this exact structure.`;

  try {
    log.ai('groq', 'llama-3.1-8b-instant', { module: 'GenerateCases', maxCases: max, coverageTypes: coverageTypes.join(',') });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? "[]";
      log.debug('Groq API success', { module: 'GenerateCases', responseLength: text.length });
      return parseArray(text, max, input, coverageTypes);
    } else {
      log.error('Groq API failed', new Error(`Status ${response.status}`), { module: 'GenerateCases', status: response.status });
    }
  } catch (error) {
    log.error('Groq error', error instanceof Error ? error : new Error(String(error)), { module: 'GenerateCases' });
  }
  
  return stubCases(input);
}

function parseArray(text: string, max: number, input: Input, coverageTypes: string[]) {
  try {
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    const arr = JSON.parse(jsonText);
    
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.slice(0, max).map((item: any, index: number) => ({
        id: String(item?.id || `TC${String(index + 1).padStart(3, '0')}`),
        title: String(item?.title || `Test Case ${index + 1}: ${input.summary?.slice(0, 30)}`),
        description: String(item?.description || ""),
        preconditions: Array.isArray(item?.preconditions) ? item.preconditions : [String(item?.preconditions || "System is accessible and user has required access")],
        steps: Array.isArray(item?.steps) ? item.steps.map((step: any) => {
          if (typeof step === 'string') {
            return { action: step, expected: "Step completed successfully" };
          }
          if (step && typeof step === 'object') {
            return {
              action: step.action || step.step || String(step),
              expected: step.expected || step['expected outcome'] || step.outcome || "Step completed successfully"
            };
          }
          return { action: String(step), expected: "Step completed successfully" };
        }) : [
          { action: "Navigate to the feature", expected: "Feature page loads correctly" },
          { action: "Perform the required action", expected: "Action executes successfully" },
          { action: "Verify the result", expected: "Expected outcome is achieved" }
        ],
        expected: String(item?.expected || "Feature works as expected"),
        priority: (() => {
          const priorityMap: Record<string, "P0" | "P1" | "P2" | "P3"> = {
            "Critical": "P0",
            "High": "P1", 
            "Medium": "P2",
            "Low": "P3"
          };
          return priorityMap[item?.priority] || "P2";
        })(),
        type: String(item?.type || coverageTypes[0]) as GeneratedTestCase['type'],
        tags: Array.isArray(item?.tags) ? item.tags : [],
      }));
    }
  } catch (error) {
    log.error('JSON parse error', error instanceof Error ? error : new Error(String(error)), { module: 'GenerateCases' });
  }

  return stubCases(input);
}

function stubCases(input: Input, max: number = 8) {
  const storyName = input.summary?.slice(0, 40) || "Feature";

  // Create more contextually relevant test scenarios
  const scenarios = [
    { action: `Access ${storyName} feature`, expected: "Feature is accessible and loads correctly" },
    { action: `Interact with ${storyName} components`, expected: "All interactive elements respond appropriately" },
    { action: `Validate ${storyName} behavior`, expected: "Feature behaves according to requirements" },
    { action: `Test ${storyName} edge cases`, expected: "System handles edge cases gracefully" },
    { action: `Verify ${storyName} error handling`, expected: "Appropriate error messages are displayed" },
    { action: `Check ${storyName} data handling`, expected: "Data is processed and stored correctly" },
    { action: `Test ${storyName} user workflow`, expected: "User can complete the intended workflow" },
    { action: `Validate ${storyName} output`, expected: "Expected results are produced and displayed" }
  ];

  return Array.from({ length: max }, (_, i) => ({
    id: `TC${String(i + 1).padStart(3, '0')}`,
    title: `Verify ${storyName} - ${scenarios[i % scenarios.length].action.replace(`${storyName} `, '')}`,
    description: `Test case to validate ${storyName} functionality and ensure proper behavior`,
    preconditions: ["System is accessible and functional", "User has appropriate access permissions"],
    steps: [
      { action: scenarios[i % scenarios.length].action, expected: scenarios[i % scenarios.length].expected },
      { action: `Verify system state after ${storyName} interaction`, expected: "System remains stable and responsive" },
      { action: "Document results", expected: "Test results are clearly documented" }
    ],
    expected: `${storyName} feature should work correctly and meet all specified requirements`,
    priority: (i < 2 ? "P1" : "P2") as "P0" | "P1" | "P2" | "P3",
    type: "functional" as const,
    tags: [],
  }));
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