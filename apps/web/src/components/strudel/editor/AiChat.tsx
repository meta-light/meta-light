'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayerStore } from '@/lib/strudel/state/store';
import { getEngine } from '@/lib/strudel/engine';
import { useSounds } from '@/lib/strudel/useSounds';
import { groupKits } from '@/lib/strudel/sounds';
import { useAiChatStore, type ChatMessage } from '@/lib/strudel/ai/store';
import { REPAIR_PROMPT } from '@/lib/strudel/ai/prompt';
import { splitReply, proposedDocument } from '@/lib/strudel/ai/parse';
import { applyProposal } from '@/lib/strudel/ai/apply';

const PROMPTS = [
  'add an open hat on the offbeats in the chorus',
  'give the bass a darker filter in the verse',
  'add a two-bar breakdown before the last chorus',
  'what does pickRestart do here?',
];

function Proposal({ message, code, streaming }: { message: ChatMessage; code: string; streaming: boolean }) {
  const setApplied = useAiChatStore((s) => s.setApplied);
  const setDiscarded = useAiChatStore((s) => s.setDiscarded);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const lines = code.trim().split('\n');
  const resolved = message.applied || message.discarded;

  const apply = () => {
    const result = applyProposal(proposedDocument(code));
    if (!result.ok) {
      setNote(result.reason ?? 'could not apply');
      return;
    }
    setNote(result.broken ? 'applied, but it has a syntax error — undo with ⌘Z' : null);
    setApplied(message.id);
  };

  return (
    <div className="rounded border border-line bg-background">
      <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
        <span className="silkscreen flex-1">
          {message.applied ? 'applied' : message.discarded ? 'discarded' : `${lines.length} lines`}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-6 rounded border border-line bg-surface-2 px-2 text-[11px] text-text-dim hover:border-line-bright hover:text-text"
        >
          {open ? 'hide' : 'view'}
        </button>
        {!resolved && !streaming && (
          <>
            <button
              type="button"
              onClick={() => setDiscarded(message.id)}
              className="h-6 rounded border border-line bg-surface-2 px-2 text-[11px] text-text-dim hover:border-ember-dim hover:text-ember"
            >
              discard
            </button>
            <button
              type="button"
              onClick={apply}
              className="h-6 rounded border border-acid-dim bg-surface-2 px-2 text-[11px] text-acid hover:border-acid"
            >
              apply
            </button>
          </>
        )}
        {message.applied && (
          <button
            type="button"
            onClick={() => getEngine()?.undo()}
            className="h-6 rounded border border-line bg-surface-2 px-2 text-[11px] text-text-dim hover:border-line-bright hover:text-text"
          >
            undo
          </button>
        )}
      </div>
      {open && (
        <pre className="max-h-64 overflow-auto p-2 text-[11px] leading-relaxed text-text-dim">{code.trim()}</pre>
      )}
      {note && <p className="px-2 pb-2 text-[11px] text-ember">{note}</p>}
    </div>
  );
}

/** A block that stopped mid-write: never applyable — half a document is broken code. */
function Incomplete({ code, truncated }: { code: string; truncated?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-ember-dim bg-background">
      <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
        <span className="silkscreen flex-1 text-ember">
          {truncated ? 'cut off at the token limit' : 'code block never finished'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-6 rounded border border-line bg-surface-2 px-2 text-[11px] text-text-dim hover:border-line-bright hover:text-text"
        >
          {open ? 'hide' : 'view'}
        </button>
      </div>
      <p className="px-2 py-1.5 text-[11px] text-text-faint">
        only part of the document arrived, so there is nothing safe to apply — retry below.
      </p>
      {open && <pre className="max-h-64 overflow-auto p-2 text-[11px] leading-relaxed text-text-dim">{code}</pre>}
    </div>
  );
}

function Bubble({
  message,
  streaming,
  onRepair,
}: {
  message: ChatMessage;
  streaming: boolean;
  onRepair: () => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="self-end rounded border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-text">
        {message.content}
      </div>
    );
  }

  const { prose, code, complete } = splitReply(message.content);
  return (
    <div className="flex flex-col gap-2">
      {prose && <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-dim">{prose}</p>}
      {code !== null &&
        (complete ? (
          <Proposal message={message} code={code} streaming={streaming} />
        ) : streaming ? (
          <div className="flex items-center gap-2 rounded border border-line bg-background px-2 py-1.5">
            <span className="led led-loading" />
            <span className="silkscreen">writing code</span>
          </div>
        ) : (
          // the stream ended with the fence still open
          <Incomplete code={code} truncated={message.truncated} />
        ))}
      {message.truncated && code === null && (
        <p className="text-[11px] text-ember">the reply was cut off at the token limit — retry below.</p>
      )}
      {/* models intermittently describe an edit and forget the block — one
          click asks for just the code rather than re-running the whole turn */}
      {code === null && prose !== '' && !streaming && !message.truncated && (
        <button
          type="button"
          onClick={onRepair}
          className="self-start rounded border border-line bg-surface-2 px-2 py-1 text-[11px] text-text-dim hover:border-acid-dim hover:text-text"
        >
          no code? ask for it
        </button>
      )}
      {!prose && code === null && streaming && (
        <div className="flex items-center gap-2">
          <span className="led led-loading" />
          <span className="silkscreen">thinking</span>
        </div>
      )}
    </div>
  );
}

export default function AiChat() {
  const messages = useAiChatStore((s) => s.messages);
  const streaming = useAiChatStore((s) => s.streaming);
  const error = useAiChatStore((s) => s.error);
  const send = useAiChatStore((s) => s.send);
  const retry = useAiChatStore((s) => s.retry);
  const abort = useAiChatStore((s) => s.abort);
  const clear = useAiChatStore((s) => s.clear);

  const bpm = usePlayerStore((s) => s.bpm);
  const chunk = usePlayerStore((s) => s.currentChunk);
  const evalError = usePlayerStore((s) => s.error);
  const sounds = useSounds();
  const kits = useMemo(() => groupKits(sounds).map((k) => ({ bank: k.bank, pieces: k.pieces })), [sounds]);

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const editorContext = () => ({ code: getEngine()?.code ?? '', bpm, chunk, error: evalError, kits });

  const submit = (text: string) => {
    if (streaming) return;
    setDraft('');
    void send(text, editorContext());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-faint">
              ask for a change and it writes the whole pattern back — apply it with one click, undo it with ⌘Z.
            </p>
            <div className="flex flex-col gap-1.5">
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submit(prompt)}
                  className="rounded border border-line bg-surface-2 px-2 py-1.5 text-left text-[11px] text-text-dim hover:border-acid-dim hover:text-text"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <Bubble
              key={message.id}
              message={message}
              streaming={streaming && i === messages.length - 1}
              onRepair={() => submit(REPAIR_PROMPT)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-ember">{error}</p>}

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          rows={3}
          spellCheck={false}
          placeholder="describe a change…"
          aria-label="Message the AI assistant"
          className="resize-none rounded border border-line bg-background px-2 py-1.5 text-xs text-text outline-none placeholder:text-text-faint focus:border-acid-dim"
        />
        <div className="flex items-center gap-2">
          <span className="silkscreen flex-1">enter to send · shift+enter for a newline</span>
          {messages.length > 0 && !streaming && (
            <button
              type="button"
              onClick={() => void retry(editorContext())}
              title="ask the last question again"
              className="h-7 rounded border border-line bg-surface-2 px-2.5 text-xs text-text-dim hover:border-line-bright hover:text-text"
            >
              retry
            </button>
          )}
          {messages.length > 0 && !streaming && (
            <button
              type="button"
              onClick={clear}
              className="h-7 rounded border border-line bg-surface-2 px-2.5 text-xs text-text-dim hover:border-line-bright hover:text-text"
            >
              clear
            </button>
          )}
          {streaming ? (
            <button
              type="button"
              onClick={abort}
              className="h-7 rounded border border-line bg-surface-2 px-3 text-xs text-text-dim hover:border-ember-dim hover:text-ember"
            >
              stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(draft)}
              disabled={draft.trim() === ''}
              className="h-7 rounded border border-acid-dim bg-surface-2 px-3 text-xs text-acid transition-colors enabled:hover:border-acid disabled:border-line disabled:text-text-faint"
            >
              send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
