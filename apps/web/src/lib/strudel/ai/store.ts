/**
 * Chat state for the AI panel.
 *
 * The request lives here rather than in the component so a reply keeps
 * streaming while the user switches to the sound browser or closes the panel.
 */
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { buildContextMessage, type EditorContext } from './prompt';
import { readTruncation, splitReply } from './parse';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** the proposal in this message was written into the editor */
  applied?: boolean;
  /** the user dismissed this proposal */
  discarded?: boolean;
  /** the model hit the token limit — anything after this point is missing */
  truncated?: boolean;
}

export interface AiChatState {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;

  send: (text: string, context: EditorContext) => Promise<void>;
  /** re-ask the last question — for a reply that arrived unusable */
  retry: (context: EditorContext) => Promise<void>;
  abort: () => void;
  clear: () => void;
  setApplied: (id: string) => void;
  setDiscarded: (id: string) => void;
}

let controller: AbortController | null = null;

/**
 * Assistant turns go back to the model without their code blocks — the context
 * block already carries the live document, so replaying every superseded
 * revision only spends tokens and invites the model to edit a stale copy.
 */
function forHistory(message: ChatMessage): { role: 'user' | 'assistant'; content: string } {
  if (message.role !== 'assistant') return { role: message.role, content: message.content };
  const { prose, code } = splitReply(message.content);
  const content = code ? `${prose}\n\n(proposed a full revision of the document)`.trim() : prose;
  return { role: 'assistant', content };
}

/** the route answers failures as `{ error }` — fall back to the raw body */
async function readError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    // not JSON
  }
  return body.slice(0, 300) || `request failed (${response.status})`;
}

export const useAiChatStore = create<AiChatState>()((set, get) => ({
  messages: [],
  streaming: false,
  error: null,

  send: async (text, context) => {
    const trimmed = text.trim();
    if (trimmed === '' || get().streaming) return;

    const history = get().messages.map(forHistory);
    const userMessage: ChatMessage = { id: nanoid(8), role: 'user', content: trimmed };
    const replyId = nanoid(8);

    set((s) => ({
      messages: [...s.messages, userMessage, { id: replyId, role: 'assistant', content: '' }],
      streaming: true,
      error: null,
    }));

    const appendToReply = (chunk: string) =>
      set((s) => ({
        messages: s.messages.map((m) => (m.id === replyId ? { ...m, content: m.content + chunk } : m)),
      }));

    controller = new AbortController();
    try {
      const response = await fetch('/api/strudel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history,
          message: trimmed,
          context: buildContextMessage(context),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(await readError(response));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        appendToReply(chunk);
      }
      const tail = decoder.decode();
      if (tail) {
        buffer += tail;
        appendToReply(tail);
      }

      // free-tier providers sometimes close the stream having sent nothing at
      // all — say so rather than leaving a blank turn in the transcript
      if (buffer.trim() === '') {
        throw new Error('the model returned an empty reply — try again');
      }

      // the truncation marker can arrive split across reads, so resolve it
      // once against the whole reply rather than per chunk
      const { content, truncated } = readTruncation(buffer);
      set((s) => ({
        messages: s.messages.map((m) => (m.id === replyId ? { ...m, content, truncated } : m)),
      }));
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      set((s) => ({
        error: aborted ? null : err instanceof Error ? err.message : 'request failed',
        // drop the placeholder if nothing ever arrived
        messages: s.messages.filter((m) => !(m.id === replyId && m.content === '')),
      }));
    } finally {
      controller = null;
      set({ streaming: false });
    }
  },

  retry: async (context) => {
    const { messages, streaming } = get();
    if (streaming) return;
    const question = [...messages].reverse().find((m) => m.role === 'user');
    if (!question) return;
    // rewind past the unusable reply and ask the same thing again, so the
    // model isn't looking at its own failed attempt
    set({ messages: messages.slice(0, messages.indexOf(question)), error: null });
    await get().send(question.content, context);
  },

  abort: () => {
    controller?.abort();
    controller = null;
  },

  clear: () => {
    controller?.abort();
    controller = null;
    set({ messages: [], streaming: false, error: null });
  },

  setApplied: (id) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, applied: true } : m)) })),

  setDiscarded: (id) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, discarded: true } : m)) })),
}));
