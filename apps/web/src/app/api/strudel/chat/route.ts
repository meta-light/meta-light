/**
 * Streaming chat endpoint for the Strudel editor's AI panel.
 *
 * Talks to OpenRouter through the OpenAI-compatible client already in the tree.
 * The key is server-only (`OPENROUTER_KEY`, no NEXT_PUBLIC_ prefix), so the
 * browser never sees it.
 */
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/strudel/ai/prompt';
import { TRUNCATED_MARKER } from '@/lib/strudel/ai/parse';

export const runtime = 'nodejs';

// Free tiers are rate-limited and occasionally flaky; this one was the most
// reliable at actually shipping a complete `strudel` block across repeated runs
// (the 550b ultra returned prose-only with reasoning disabled). Override with
// OPENROUTER_MODEL to point at a paid model.
const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
/** a couple of sentences plus a whole ~50-line document, with headroom */
const DEFAULT_MAX_TOKENS = 8000;
/** keep the prompt bounded — the context block already carries the live doc */
const MAX_HISTORY = 12;

interface ChatRequest {
  history?: { role: 'user' | 'assistant'; content: string }[];
  message?: string;
  context?: string;
}

/** `reasoning` is an OpenRouter extension the OpenAI types don't model. */
type Body = OpenAI.ChatCompletionCreateParamsStreaming & {
  reasoning?: { effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high'; exclude?: boolean };
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_KEY is not set on the server' }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'expected a JSON body' }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const history = (body.history ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY);

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const params: Body = {
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS) || DEFAULT_MAX_TOKENS,
    stream: true,
    // Reasoning tokens are invisible but spend max_tokens, so a thinking model
    // can burn the whole budget and break off mid-code-block. Writing a 50-line
    // pattern doesn't need it; off keeps the budget predictable.
    reasoning: { effort: 'none' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      // the context block rides with the live turn so the model always sees
      // the document as it stands right now, not as it stood mid-conversation
      { role: 'user', content: body.context ? `${body.context}\n\n---\n\n${message}` : message },
    ],
  };

  try {
    let stream;
    try {
      stream = await client.chat.completions.create(params);
    } catch (err) {
      // some endpoints (gpt-oss, several reasoning-only models) reject the
      // reasoning switch with "Reasoning is mandatory for this endpoint" —
      // drop it and let them think rather than failing the whole request
      if (err instanceof OpenAI.APIError && err.status === 400 && /reasoning/i.test(err.message)) {
        const { reasoning: _dropped, ...rest } = params;
        stream = await client.chat.completions.create(rest);
      } else {
        throw err;
      }
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let finish: string | null | undefined;
        try {
          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            const delta = choice?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
            if (choice?.finish_reason) finish = choice.finish_reason;
          }
          // a cut-off reply almost always breaks off inside the code block —
          // tell the client so it can say so instead of spinning forever
          if (finish === 'length') controller.enqueue(encoder.encode(TRUNCATED_MARKER));
          controller.close();
        } catch (err) {
          // the response has already begun — surface the failure inline rather
          // than dropping the connection silently
          const detail = err instanceof Error ? err.message : 'stream failed';
          controller.enqueue(encoder.encode(`\n\n[stream interrupted: ${detail}]`));
          controller.close();
        }
      },
      cancel() {
        void stream.controller.abort();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'request failed';
    const status = err instanceof OpenAI.APIError ? (err.status ?? 502) : 502;
    return NextResponse.json({ error: detail }, { status });
  }
}
