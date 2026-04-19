import { log } from "@/lib/utils/logger";
import {
  buildGenerateCasesPrompt,
} from "@/lib/ai/prompts/generateCases";
import { generateCasesCache, hashKey } from "@/lib/ai/cache";
import {
  loadSelectorContextSafe,
  parseArray,
  stubCases,
  type GeneratedTestCase,
} from "@/lib/ai/generateCases";

/**
 * Streaming variant of `generateCasesAI`.
 *
 * Emits a sequence of SSE-friendly events that callers can pipe directly
 * into a `Response` body. The endpoint route owns the HTTP framing; this
 * module is transport-agnostic so it stays unit-testable.
 *
 * Event protocol (text/event-stream):
 *
 *   event: token         data: { "text": "..."  }   // raw model token
 *   event: progress      data: { "approxPercent": 35 } // optional UI hint
 *   event: complete      data: { "cases": [...] }   // final parsed array
 *   event: error         data: { "message": "..." }
 *
 * Cache hits short-circuit straight to a single `complete` event so the
 * UI behaves identically whether the answer is cached or freshly streamed.
 */

export type StreamEvent =
  | { event: "token"; data: { text: string } }
  | { event: "progress"; data: { approxPercent: number } }
  | { event: "complete"; data: { cases: GeneratedTestCase[]; cached: boolean } }
  | { event: "error"; data: { message: string } };

type StreamInput = {
  summary: string;
  description?: string;
  ac?: string;
  coverage?: string;
  maxCases?: number;
  environmentUrl?: string;
  pageName?: string;
};

export async function* generateCasesAIStream(
  input: StreamInput,
): AsyncGenerator<StreamEvent, void, void> {
  const groqKey = process.env.GROQ_API_KEY;
  const max = Math.min(Math.max(input.maxCases ?? 8, 3), 20);
  const coverageTypes = input.coverage
    ? input.coverage.split(",").map((c) => c.trim())
    : ["functional"];

  if (!groqKey) {
    yield { event: "complete", data: { cases: stubCases(input, max), cached: false } };
    return;
  }

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
    log.debug("AI stream cache hit", { module: "GenerateCasesStream", cacheKey });
    yield { event: "progress", data: { approxPercent: 100 } };
    yield { event: "complete", data: { cases: cached, cached: true } };
    return;
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

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
        stream: true,
      }),
    });
  } catch (err) {
    yield {
      event: "error",
      data: { message: err instanceof Error ? err.message : "Network error contacting Groq" },
    };
    yield { event: "complete", data: { cases: stubCases(input, max), cached: false } };
    return;
  }

  if (!response.ok || !response.body) {
    const status = response.status;
    yield { event: "error", data: { message: `Groq API failed (status ${status})` } };
    yield { event: "complete", data: { cases: stubCases(input, max), cached: false } };
    return;
  }

  // Approximate progress: Groq streams ~3000 tokens of JSON. We update at
  // every 100-token chunk to keep the UI responsive without busy-looping.
  const TARGET_TOKENS = 3000;
  let accumulated = "";
  let tokensSeen = 0;
  let lastProgress = 0;

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE lines from Groq look like: "data: {...}\n\n" or "data: [DONE]\n\n"
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload);
          const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            accumulated += delta;
            tokensSeen += 1;
            yield { event: "token", data: { text: delta } };
            const approxPercent = Math.min(99, Math.floor((tokensSeen / TARGET_TOKENS) * 100));
            if (approxPercent - lastProgress >= 5) {
              lastProgress = approxPercent;
              yield { event: "progress", data: { approxPercent } };
            }
          }
        } catch {
          // Groq occasionally sends partial frames; safe to skip them.
        }
      }
    }
  } catch (err) {
    yield {
      event: "error",
      data: { message: err instanceof Error ? err.message : "Stream interrupted" },
    };
  } finally {
    reader.releaseLock();
  }

  const cases = parseArray(accumulated, max, input, coverageTypes);
  generateCasesCache.set(cacheKey, cases);
  yield { event: "progress", data: { approxPercent: 100 } };
  yield { event: "complete", data: { cases, cached: false } };
}
