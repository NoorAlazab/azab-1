import { log } from "@/lib/utils/logger";
import { loadSelectorMapping } from "@/lib/server/exploration/selectorRepository";
import {
  buildGenerateCasesPrompt,
  buildSelectorContext,
} from "@/lib/server/ai/prompts/generateCases";
import { generateCasesCache, hashKey } from "@/lib/server/ai/cache";

type Input = {
  summary: string;
  description?: string;
  ac?: string;
  coverage?: string;
  maxCases?: number;
  environmentUrl?: string;
  pageName?: string;
};

export type GeneratedTestCase = {
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
  log.debug("AI generation called", {
    module: "GenerateCases",
    summary: input.summary?.substring(0, 50),
  });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    log.debug("No Groq API key found, using stub cases", { module: "GenerateCases" });
    return stubCases(input);
  }

  const max = Math.min(Math.max(input.maxCases ?? 8, 3), 20);
  const coverageTypes = input.coverage
    ? input.coverage.split(",").map((c) => c.trim())
    : ["functional"];

  // Hit the cache early — same inputs are very common (user clicks "regenerate"
  // or refreshes the suite). The cache key includes everything that affects
  // the prompt; selector context is not part of it because it is loaded
  // dynamically and identical inputs will resolve to identical contexts.
  const cacheKey = hashKey([
    "generateCasesAI/v1",
    input.summary,
    input.description ?? "",
    input.ac ?? "",
    coverageTypes.join(","),
    max,
    input.environmentUrl ?? "",
    input.pageName ?? "",
  ]);
  const cached = generateCasesCache.get(cacheKey) as GeneratedTestCase[] | undefined;
  if (cached) {
    log.debug("AI cache hit", { module: "GenerateCases", cacheKey });
    return cached;
  }

  const selectorContext = await loadSelectorContextSafe(input);
  const prompt = buildGenerateCasesPrompt({
    summary: input.summary,
    description: input.description,
    ac: input.ac,
    coverageTypes,
    maxCases: max,
    selectorContext,
  });

  try {
    log.ai("groq", "llama-3.1-8b-instant", {
      module: "GenerateCases",
      maxCases: max,
      coverageTypes: coverageTypes.join(","),
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${groqKey}`,
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
      log.debug("Groq API success", {
        module: "GenerateCases",
        responseLength: text.length,
      });
      const parsed = parseArray(text, max, input, coverageTypes);
      generateCasesCache.set(cacheKey, parsed);
      return parsed;
    } else {
      log.error("Groq API failed", new Error(`Status ${response.status}`), {
        module: "GenerateCases",
        status: response.status,
      });
    }
  } catch (error) {
    log.error("Groq error", error instanceof Error ? error : new Error(String(error)), {
      module: "GenerateCases",
    });
  }

  return stubCases(input);
}

/**
 * Parsing is also exported so the streaming variant can share the same
 * tolerant fallback behavior on the final accumulated text.
 */
export function parseArray(
  text: string,
  max: number,
  input: Input,
  coverageTypes: string[],
): GeneratedTestCase[] {
  try {
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonText = jsonMatch[0];

    const arr = JSON.parse(jsonText);

    if (Array.isArray(arr) && arr.length > 0) {
      return arr.slice(0, max).map((item: any, index: number) => ({
        id: String(item?.id || `TC${String(index + 1).padStart(3, "0")}`),
        title: String(
          item?.title || `Test Case ${index + 1}: ${input.summary?.slice(0, 30)}`,
        ),
        description: String(item?.description || ""),
        preconditions: Array.isArray(item?.preconditions)
          ? item.preconditions
          : [String(item?.preconditions || "System is accessible and user has required access")],
        steps: Array.isArray(item?.steps)
          ? item.steps.map((step: any) => {
              if (typeof step === "string") {
                return { action: step, expected: "Step completed successfully" };
              }
              if (step && typeof step === "object") {
                return {
                  action: step.action || step.step || String(step),
                  expected:
                    step.expected ||
                    step["expected outcome"] ||
                    step.outcome ||
                    "Step completed successfully",
                };
              }
              return { action: String(step), expected: "Step completed successfully" };
            })
          : [
              { action: "Navigate to the feature", expected: "Feature page loads correctly" },
              { action: "Perform the required action", expected: "Action executes successfully" },
              { action: "Verify the result", expected: "Expected outcome is achieved" },
            ],
        expected: String(item?.expected || "Feature works as expected"),
        priority: (() => {
          const priorityMap: Record<string, "P0" | "P1" | "P2" | "P3"> = {
            Critical: "P0",
            High: "P1",
            Medium: "P2",
            Low: "P3",
          };
          return priorityMap[item?.priority] || "P2";
        })(),
        type: String(item?.type || coverageTypes[0]) as GeneratedTestCase["type"],
        tags: Array.isArray(item?.tags) ? item.tags : [],
      }));
    }
  } catch (error) {
    log.error("JSON parse error", error instanceof Error ? error : new Error(String(error)), {
      module: "GenerateCases",
    });
  }

  return stubCases(input);
}

/**
 * Selector loading is best-effort. Network/disk errors degrade silently
 * to "no selector context" rather than failing the whole generation.
 */
export async function loadSelectorContextSafe(input: Input): Promise<string> {
  if (!input.environmentUrl && !input.pageName) return "";
  try {
    const pageName = input.pageName || derivePageFromUrl(input.environmentUrl || "");
    const environmentSlug = input.environmentUrl ? urlToSlug(input.environmentUrl) : undefined;

    const mapping = await loadSelectorMapping(pageName, environmentSlug);
    if (!mapping || !mapping.elements) return "";
    const ctx = buildSelectorContext(pageName, mapping.elements);
    if (ctx) {
      log.info("Loaded selector context for AI", {
        module: "GenerateCases",
        pageName,
        elementCount: Object.keys(mapping.elements).length,
      });
    }
    return ctx;
  } catch (error) {
    log.debug("Could not load selector context, using naming patterns instead", {
      module: "GenerateCases",
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

export function stubCases(input: Input, max: number = 8): GeneratedTestCase[] {
  const storyName = input.summary?.slice(0, 40) || "Feature";

  const scenarios = [
    { action: `Access ${storyName} feature`, expected: "Feature is accessible and loads correctly" },
    { action: `Interact with ${storyName} components`, expected: "All interactive elements respond appropriately" },
    { action: `Validate ${storyName} behavior`, expected: "Feature behaves according to requirements" },
    { action: `Test ${storyName} edge cases`, expected: "System handles edge cases gracefully" },
    { action: `Verify ${storyName} error handling`, expected: "Appropriate error messages are displayed" },
    { action: `Check ${storyName} data handling`, expected: "Data is processed and stored correctly" },
    { action: `Test ${storyName} user workflow`, expected: "User can complete the intended workflow" },
    { action: `Validate ${storyName} output`, expected: "Expected results are produced and displayed" },
  ];

  return Array.from({ length: max }, (_, i) => ({
    id: `TC${String(i + 1).padStart(3, "0")}`,
    title: `Verify ${storyName} - ${scenarios[i % scenarios.length].action.replace(`${storyName} `, "")}`,
    description: `Test case to validate ${storyName} functionality and ensure proper behavior`,
    preconditions: ["System is accessible and functional", "User has appropriate access permissions"],
    steps: [
      { action: scenarios[i % scenarios.length].action, expected: scenarios[i % scenarios.length].expected },
      { action: `Verify system state after ${storyName} interaction`, expected: "System remains stable and responsive" },
      { action: "Document results", expected: "Test results are clearly documented" },
    ],
    expected: `${storyName} feature should work correctly and meet all specified requirements`,
    priority: (i < 2 ? "P1" : "P2") as "P0" | "P1" | "P2" | "P3",
    type: "functional" as const,
    tags: [],
  }));
}

function derivePageFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\/+|\/+$/g, "");
    if (!path) return "home";
    return path.split("/")[0] || "home";
  } catch {
    return "home";
  }
}

function urlToSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/\./g, "-");
  } catch {
    return url.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }
}
