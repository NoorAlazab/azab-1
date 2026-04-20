/**
 * AI Client for exploration analysis and bug detection
 * Supports Groq, OpenAI, and Anthropic APIs (prefers Groq if available)
 */

import { log } from '@/lib/shared/utils/logger';

interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Get API configuration from environment
const getAIConfig = () => {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Determine provider priority: Groq > Anthropic > OpenAI
  let provider: "groq" | "anthropic" | "openai";
  let apiKey: string | undefined;
  let model: string;

  if (groqKey) {
    provider = "groq";
    apiKey = groqKey;
    model = process.env.AI_MODEL || "llama-3.1-8b-instant";
  } else if (anthropicKey) {
    provider = "anthropic";
    apiKey = anthropicKey;
    model = process.env.AI_MODEL || "claude-3-5-sonnet-20241022";
  } else if (openaiKey) {
    provider = "openai";
    apiKey = openaiKey;
    model = process.env.AI_MODEL || "gpt-4";
  } else {
    throw new Error("Either GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY must be set");
  }

  log.debug('AI config check', {
    module: 'AIClient',
    hasGroq: !!groqKey,
    hasOpenAI: !!openaiKey,
    hasAnthropic: !!anthropicKey,
    provider,
    model,
  });

  return {
    provider,
    apiKey,
    model,
  };
};

/**
 * Call OpenAI API
 */
async function callOpenAI(messages: AIMessage[], model: string, apiKey: string): Promise<AIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(messages: AIMessage[], model: string, apiKey: string): Promise<AIResponse> {
  // Extract system message
  const systemMessage = messages.find(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemMessage?.content || "",
      messages: conversationMessages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  return {
    content: data.content[0].text,
    usage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  };
}

/**
 * Call Groq API (uses OpenAI-compatible endpoint)
 */
async function callGroq(messages: AIMessage[], model: string, apiKey: string): Promise<AIResponse> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

/**
 * Main AI completion function
 */
export async function getAICompletion(messages: AIMessage[]): Promise<AIResponse> {
  const config = getAIConfig();

  log.ai(config.provider, config.model, { module: 'AIClient', messagesCount: messages.length });

  if (config.provider === "groq") {
    return await callGroq(messages, config.model, config.apiKey!);
  } else if (config.provider === "anthropic") {
    return await callAnthropic(messages, config.model, config.apiKey!);
  } else {
    return await callOpenAI(messages, config.model, config.apiKey!);
  }
}

/**
 * Generate test plan from story content
 */
export async function generateTestPlan(
  summary: string,
  description: string,
  acceptanceCriteria: string
): Promise<string[]> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: "You are a QA expert helping to create test scenarios from user stories. Generate specific, actionable test scenarios that can be automated.",
    },
    {
      role: "user",
      content: `Given this user story, generate a list of test scenarios:

**Summary:** ${summary}

**Description:** ${description}

**Acceptance Criteria:** ${acceptanceCriteria}

Generate 3-8 specific test scenarios that should be validated. Return ONLY a JSON array of strings, like: ["scenario 1", "scenario 2", ...]`,
    },
  ];

  const response = await getAICompletion(messages);

  try {
    // Extract JSON array from response
    const match = response.content.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (e) {
    log.error("Failed to parse test scenarios", e instanceof Error ? e : new Error(String(e)), { module: 'AIClient' });
  }

  // Fallback: split by newlines if JSON parsing fails
  return response.content
    .split('\n')
    .filter(line => line.trim().length > 20)
    .slice(0, 8);
}

/**
 * Analyze page state and suggest next action for exploration
 */
export async function suggestNextAction(
  currentUrl: string,
  pageTitle: string,
  visibleText: string,
  testScenarios: string[],
  completedActions: string[]
): Promise<{
  action: "click" | "type" | "navigate" | "complete";
  selector?: string;
  value?: string;
  reasoning: string;
}> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: "You are an AI helping to explore a web application. Suggest the next action to take to test the application against the given scenarios.",
    },
    {
      role: "user",
      content: `Current state:
- URL: ${currentUrl}
- Page title: ${pageTitle}
- Visible text (truncated): ${visibleText.substring(0, 500)}

Test scenarios to validate:
${testScenarios.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Actions completed so far:
${completedActions.length > 0 ? completedActions.join('\n') : 'None'}

Suggest the next action to take. Return ONLY a JSON object with this format:
{
  "action": "click|type|navigate|complete",
  "selector": "CSS selector (for click/type)",
  "value": "text to type (for type action)",
  "reasoning": "why this action"
}`,
    },
  ];

  const response = await getAICompletion(messages);

  try {
    const match = response.content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (e) {
    log.error("Failed to parse next action", e instanceof Error ? e : new Error(String(e)), { module: 'AIClient' });
  }

  // Fallback: complete if we can't parse
  return {
    action: "complete",
    reasoning: "Could not determine next action",
  };
}

/**
 * Analyze exploration results to identify bugs
 */
export async function analyzeBugs(
  testScenarios: string[],
  explorationLog: string,
  consoleErrors: string[],
  failedRequests: string[]
): Promise<Array<{
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
}>> {
  log.debug('analyzeBugs called', {
    module: 'AIClient',
    testScenariosCount: testScenarios.length,
    consoleErrorsCount: consoleErrors.length,
    failedRequestsCount: failedRequests.length,
  });

  const messages: AIMessage[] = [
    {
      role: "system",
      content: "You are a QA expert analyzing test results to identify bugs. Focus on issues directly related to the story requirements. Be thorough but avoid false positives - only report bugs that clearly relate to what's being tested.",
    },
    {
      role: "user",
      content: `Story/Feature being tested:
${testScenarios.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Pages explored:
${explorationLog}

Console errors found:
${consoleErrors.length > 0 ? consoleErrors.join('\n') : 'None'}

Failed network requests:
${failedRequests.length > 0 ? failedRequests.join('\n') : 'None'}

IMPORTANT: Only report bugs that are RELEVANT to the story/feature being tested above.
Ignore unrelated technical issues, third-party errors, or minor warnings that don't affect the feature.

Return ONLY a JSON array of bugs related to the story:
[
  {
    "title": "Bug title that clearly relates to the story",
    "description": "Detailed description explaining how this affects the feature",
    "severity": "critical|high|medium|low",
    "category": "functionality|ui|performance|accessibility|console_error|network|other"
  }
]

If no story-related bugs found, return an empty array []`,
    },
  ];

  const response = await getAICompletion(messages);

  log.debug('Got response from AI', {
    module: 'AIClient',
    contentLength: response.content.length,
    contentPreview: response.content.substring(0, 200),
  });

  try {
    const match = response.content.match(/\[[\s\S]*\]/);
    if (match) {
      const bugs = JSON.parse(match[0]);
      log.debug('Successfully parsed bugs from AI response', { module: 'AIClient', bugsCount: bugs.length });
      return bugs;
    } else {
      log.warn('No JSON array found in AI response', { module: 'AIClient' });
    }
  } catch (e) {
    log.error("Failed to parse bugs", e instanceof Error ? e : new Error(String(e)), { module: 'AIClient' });
  }

  return [];
}
