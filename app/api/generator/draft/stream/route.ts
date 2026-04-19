export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { generateCasesAIStream, type StreamEvent } from "@/lib/ai/generateCasesStream";
import { withRoute } from "@/lib/api/withRoute";
import { apiError } from "@/lib/api/response";
import { z } from "zod";

/**
 * POST /api/generator/draft/stream
 *
 * Server-Sent Events (SSE) variant of /api/generator/draft. The client
 * opens a fetch and reads the body as an event stream:
 *
 *   const res = await fetch("/api/generator/draft/stream", {
 *     method: "POST",
 *     headers: { "content-type": "application/json", "x-csrf-token": csrf },
 *     body: JSON.stringify({ story: { summary: "..." }, coverage: "functional" }),
 *   });
 *   const reader = res.body!.getReader();
 *   ...
 *
 * Why SSE and not WebSockets? The transport is unidirectional (server →
 * client) and we already have HTTP auth/CSRF/cookies — SSE adds zero
 * infrastructure on top of plain fetch. Why not the AI SDK's built-in
 * `StreamingTextResponse`? We want structured events (token, progress,
 * complete, error), not just plain text, so we frame our own protocol.
 *
 * NOTE: this endpoint does NOT yet persist generated cases to the
 * database. The non-streaming /api/generator/draft remains the source of
 * truth for persistence; this endpoint is intended for the live preview
 * UI. After the user confirms, the regular endpoint commits the result.
 */

const streamBodySchema = z.object({
  story: z.object({
    summary: z.string().min(1),
    descriptionText: z.string().optional(),
    acceptanceCriteriaText: z.string().optional(),
  }),
  coverage: z.string().optional(),
  maxCases: z.number().int().min(1).max(50).optional(),
  environmentUrl: z.string().url().optional(),
  pageName: z.string().optional(),
});

export const POST = withRoute(
  { auth: true, csrf: true, body: streamBodySchema },
  async ({ userId, body }) => {
    if (!userId) return apiError("AUTH_REQUIRED", 401);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (evt: StreamEvent) => {
          const frame = `event: ${evt.event}\ndata: ${JSON.stringify(evt.data)}\n\n`;
          controller.enqueue(encoder.encode(frame));
        };

        try {
          for await (const evt of generateCasesAIStream({
            summary: body.story.summary,
            description: body.story.descriptionText,
            ac: body.story.acceptanceCriteriaText,
            coverage: body.coverage,
            maxCases: body.maxCases,
            environmentUrl: body.environmentUrl,
            pageName: body.pageName,
          })) {
            send(evt);
          }
        } catch (err) {
          send({
            event: "error",
            data: { message: err instanceof Error ? err.message : "Unknown error" },
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
);
