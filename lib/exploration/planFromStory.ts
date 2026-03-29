import type { Objective, Scope, SynthesizedCase } from "@/types/exploration";
import { classifyIntent, getSynonyms, calculateTokenOverlap, type StoryIntent } from "./intent";

export interface PlanInput {
  summary: string;
  description?: string;
  acceptanceCriteria?: string;
  envUrl: string;
  testCases: SynthesizedCase[];
}

export interface ExplorationPlan {
  scope: Scope;
  objectives: Objective[];
  intent: {
    primary: StoryIntent;
    all: StoryIntent[];
    terms: {
      from?: string;
      to?: string;
      elementHints: string[];
    };
  };
}

/**
 * Build an exploration plan from story info and synthesized test cases
 */
export function buildPlan(input: PlanInput): ExplorationPlan {
  // Classify intent first
  const classification = classifyIntent(
    input.summary,
    input.description,
    input.acceptanceCriteria
  );

  const scope = buildScope(input, classification);
  const objectives = buildObjectives(input, scope, classification);

  return {
    scope,
    objectives,
    intent: {
      primary: classification.intents[0],
      all: classification.intents,
      terms: classification.terms,
    },
  };
}

/**
 * Build scope from environment URL and story keywords
 */
function buildScope(input: PlanInput, classification: ReturnType<typeof classifyIntent>): Scope {
  const url = new URL(input.envUrl);
  const host = url.hostname;

  const allText = `${input.summary} ${input.description || ""} ${input.acceptanceCriteria || ""}`.toLowerCase();

  // Extract keywords from classification terms
  const keywords: string[] = [];
  if (classification.terms.to) {
    keywords.push(classification.terms.to);
  }
  if (classification.terms.from) {
    keywords.push(classification.terms.from);
  }

  // Infer likely paths from keywords and intent
  const allowedPaths: string[] = [];

  // For UI_TEXT_CHANGE, paths are optional (could be anywhere)
  if (classification.intents[0] !== "UI_TEXT_CHANGE") {
    if (/login|sign.?in|auth/.test(allText)) {
      allowedPaths.push("/login", "/signin", "/auth");
    }
    if (/profile|account/.test(allText)) {
      allowedPaths.push("/profile", "/account", "/settings");
    }
    if (/search/.test(allText)) {
      allowedPaths.push("/search");
    }
    if (/checkout|cart/.test(allText)) {
      allowedPaths.push("/checkout", "/cart");
    }
    if (/dashboard/.test(allText)) {
      allowedPaths.push("/dashboard", "/home");
    }
  }

  return {
    allowedHosts: [host],
    allowedPaths: allowedPaths.length > 0 ? allowedPaths : undefined,
    includeThirdParty: false,
    keywords,
  };
}

/**
 * Convert test cases to concrete objectives based on intent
 */
function buildObjectives(
  input: PlanInput,
  scope: Scope,
  classification: ReturnType<typeof classifyIntent>
): Objective[] {
  const { intents, terms } = classification;
  const primaryIntent = intents[0];

  let objectives: Objective[] = [];

  // Special handling for UI_TEXT_CHANGE
  if (primaryIntent === "UI_TEXT_CHANGE") {
    objectives = buildUITextChangeObjectives(input, terms);
  } else {
    // Build objectives from test cases for other intents
    for (const testCase of input.testCases) {
      const objective = buildObjectiveFromCase(testCase, scope, classification);
      if (objective) {
        objectives.push(objective);
      }
    }
  }

  // Filter objectives by token overlap with story
  const storyText = `${input.summary} ${input.description || ""} ${input.acceptanceCriteria || ""}`;
  objectives = objectives.filter(obj => {
    const objText = `${obj.title} ${obj.steps?.join(' ') || ''} ${obj.target.texts?.join(' ') || ''}`;
    const overlap = calculateTokenOverlap(objText, storyText);
    return overlap >= 0.3 || obj.type === "UI_TEXT_MATCH"; // Lower threshold, always keep UI_TEXT_MATCH
  });

  // Ensure minimum set for UI_TEXT_CHANGE
  if (primaryIntent === "UI_TEXT_CHANGE" && objectives.length === 0 && terms.to) {
    objectives.push(createMinimalUITextObjective(terms));
  }

  return objectives;
}

/**
 * Build objectives specifically for UI text change stories
 */
function buildUITextChangeObjectives(
  input: PlanInput,
  terms: { from?: string; to?: string; elementHints: string[] }
): Objective[] {
  const objectives: Objective[] = [];

  if (!terms.to) {
    return objectives;
  }

  const roles = terms.elementHints.length > 0 ? terms.elementHints : ["button", "link"];
  const fromSynonyms = terms.from ? getSynonyms(terms.from) : [];

  // High priority: UI_TEXT_MATCH - verify new text is present
  objectives.push({
    id: `obj-uitext-${Math.random().toString(36).substr(2, 9)}`,
    type: "UI_TEXT_MATCH",
    title: `Verify ${roles[0]} text changed to "${terms.to}"`,
    target: {
      roles,
      texts: [terms.to],
      notTexts: fromSynonyms.length > 0 ? fromSynonyms : undefined,
    },
    steps: [
      `Navigate to the page with the ${roles[0]}`,
      `Locate the ${roles[0]} by role`,
      `Verify the ${roles[0]} displays "${terms.to}"`,
      ...(fromSynonyms.length > 0 ? [`Verify the ${roles[0]} does not display "${terms.from}"`] : []),
    ],
    expects: {
      textEquals: terms.to,
    },
    severity: "S1",
  });

  // Medium priority: ELEMENT_PRESENCE - ensure element exists
  objectives.push({
    id: `obj-presence-${Math.random().toString(36).substr(2, 9)}`,
    type: "ELEMENT_PRESENCE",
    title: `Verify ${roles[0]} labeled "${terms.to}" exists and is visible`,
    target: {
      roles,
      texts: [terms.to],
    },
    steps: [
      `Navigate to the page with the ${roles[0]}`,
      `Search for ${roles[0]} with accessible name "${terms.to}"`,
      `Verify ${roles[0]} is visible and enabled`,
    ],
    expects: {
      exists: true,
    },
    severity: "S2",
  });

  // Low priority: A11Y_RULE - verify accessible name
  if (roles.includes("button") || roles.includes("link")) {
    objectives.push({
      id: `obj-a11y-${Math.random().toString(36).substr(2, 9)}`,
      type: "A11Y_RULE",
      title: `Verify ${roles[0]} has accessible name "${terms.to}"`,
      target: {
        roles,
        texts: [terms.to],
      },
      steps: [
        `Navigate to the page with the ${roles[0]}`,
        `Inspect ${roles[0]} accessibility properties`,
        `Verify accessible name equals "${terms.to}"`,
      ],
      expects: {
        a11yRule: `accessible-name-equals-${terms.to}`,
      },
      severity: "S3",
    });
  }

  return objectives;
}

/**
 * Create a minimal UI text objective when no other objectives were generated
 */
function createMinimalUITextObjective(
  terms: { from?: string; to?: string; elementHints: string[] }
): Objective {
  const roles = terms.elementHints.length > 0 ? terms.elementHints : ["button", "link"];
  const fromSynonyms = terms.from ? getSynonyms(terms.from) : [];

  return {
    id: `obj-minimal-${Math.random().toString(36).substr(2, 9)}`,
    type: "UI_TEXT_MATCH",
    title: `Verify UI element displays "${terms.to}"`,
    target: {
      roles,
      texts: [terms.to!],
      notTexts: fromSynonyms.length > 0 ? fromSynonyms : undefined,
    },
    steps: [
      `Locate element by role (${roles.join(' or ')})`,
      `Verify text equals "${terms.to}"`,
    ],
    expects: {
      textEquals: terms.to!,
    },
    severity: "S2",
  };
}

/**
 * Build a single objective from a test case
 */
function buildObjectiveFromCase(
  testCase: SynthesizedCase,
  scope: Scope,
  classification: ReturnType<typeof classifyIntent>
): Objective | null {
  const { intents } = classification;

  // Skip if this is a UI_TEXT_CHANGE story (handled separately)
  if (intents[0] === "UI_TEXT_CHANGE") {
    return null;
  }
  const id = `obj-${Math.random().toString(36).substr(2, 9)}`;

  // Extract roles, texts, and paths from steps
  const target = extractTargetsFromSteps(testCase.steps);

  // Determine objective type based on steps and expected
  let type: Objective["type"] = "ACTION_FLOW";
  const stepsText = testCase.steps.join(" ").toLowerCase();
  const expectedText = testCase.expected.toLowerCase();

  if (/verify.*text|check.*display|text.*equals/.test(expectedText)) {
    type = "UI_TEXT_MATCH";
  } else if (/element.*present|button.*exists|field.*visible/.test(expectedText)) {
    type = "ELEMENT_PRESENCE";
  } else if (/validat|error|invalid/.test(expectedText)) {
    type = "VALIDATION";
  } else if (/accessibility|a11y|wcag/.test(stepsText)) {
    type = "A11Y_RULE";
  }

  // Build expects based on type and test case
  const expects: Objective["expects"] = {};

  if (type === "UI_TEXT_MATCH") {
    const textMatch = testCase.expected.match(/['"]([^'"]+)['"]/);
    if (textMatch) {
      expects.textEquals = textMatch[1];
    }
  } else if (type === "ELEMENT_PRESENCE") {
    expects.exists = true;
  } else if (type === "VALIDATION") {
    const errorMatch = testCase.expected.match(/error|validation/i);
    if (errorMatch) {
      expects.textEquals = "error"; // Generic error expectation
    }
  }

  // Infer navigation expectation
  const navMatch = testCase.expected.match(
    /navigat.*to\s+([\/\w-]+)|redirect.*to\s+([\/\w-]+)/i
  );
  if (navMatch) {
    expects.navigatesToPath = navMatch[1] || navMatch[2];
  }

  // Map priority to severity
  const severity = priorityToSeverity(testCase.priority);

  return {
    id,
    type,
    title: testCase.title,
    target,
    steps: testCase.steps,
    expects,
    severity,
  };
}

/**
 * Extract roles, texts, and paths from test steps
 */
function extractTargetsFromSteps(steps: string[]): Objective["target"] {
  const roles: string[] = [];
  const texts: string[] = [];
  const paths: string[] = [];
  const selectors: string[] = [];

  for (const step of steps) {
    const stepLower = step.toLowerCase();

    // Extract roles
    if (/click.*button/.test(stepLower)) {
      roles.push("button");
      const textMatch = step.match(/['"]([^'"]+)['"]|click\s+(?:the\s+)?(\w+)\s+button/i);
      if (textMatch) {
        texts.push(textMatch[1] || textMatch[2]);
      }
    } else if (/click.*link/.test(stepLower)) {
      roles.push("link");
      const textMatch = step.match(/['"]([^'"]+)['"]|click\s+(?:the\s+)?(\w+)\s+link/i);
      if (textMatch) {
        texts.push(textMatch[1] || textMatch[2]);
      }
    } else if (/enter|fill|type|input/.test(stepLower)) {
      roles.push("textbox");
      const fieldMatch = step.match(/(?:enter|fill|type)\s+.*?(?:in|into)\s+(?:the\s+)?['"]?(\w+)['"]?/i);
      if (fieldMatch) {
        texts.push(fieldMatch[1]);
      }
    }

    // Extract paths (must start with / to be valid)
    const pathMatch = step.match(/navigate.*?to\s+(\/[\w\/-]+)|visit\s+(\/[\w\/-]+)|go\s+to\s+(\/[\w\/-]+)/i);
    if (pathMatch) {
      const path = pathMatch[1] || pathMatch[2] || pathMatch[3];
      if (path && path.startsWith('/') && path.length > 1) {
        paths.push(path);
      }
    }

    // Extract selectors (basic CSS selectors if mentioned)
    const selectorMatch = step.match(/#[\w-]+|\.[\w-]+|\[[\w-]+\]/);
    if (selectorMatch) {
      selectors.push(selectorMatch[0]);
    }
  }

  return {
    roles: roles.length > 0 ? Array.from(new Set(roles)) : undefined,
    texts: texts.length > 0 ? Array.from(new Set(texts)) : undefined,
    paths: paths.length > 0 ? Array.from(new Set(paths)) : undefined,
    selectors: selectors.length > 0 ? Array.from(new Set(selectors)) : undefined,
  };
}

/**
 * Convert test case priority to objective severity
 */
function priorityToSeverity(priority?: string): "S1" | "S2" | "S3" {
  if (!priority) return "S2";

  const p = priority.toUpperCase();
  if (p === "P0" || p === "P1") return "S1";
  if (p === "P2") return "S2";
  return "S3";
}
