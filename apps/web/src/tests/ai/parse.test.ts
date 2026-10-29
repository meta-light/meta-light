import { describe, expect, it } from 'vitest';
import { proposedDocument, readTruncation, splitReply, TRUNCATED_MARKER } from '@/lib/strudel/ai/parse';

describe('splitReply', () => {
  it('separates prose from a complete tagged block', () => {
    const reply = 'Busier hats in the chorus.\n\n```strudel\nhats: s("hh oh hh oh")\n```\n\nApply when ready.';
    const { prose, code, complete } = splitReply(reply);
    expect(prose).toBe('Busier hats in the chorus.\n\nApply when ready.');
    // the block keeps its own trailing newline — proposedDocument normalizes it
    expect(code).toBe('hats: s("hh oh hh oh")\n');
    expect(complete).toBe(true);
  });

  it('reads an untagged fence as code too', () => {
    const { code, complete } = splitReply('here:\n\n```\ns("bd sd")\n```');
    expect(code).toBe('s("bd sd")\n');
    expect(complete).toBe(true);
  });

  it('reports a still-open fence as incomplete', () => {
    const { prose, code, complete } = splitReply('Rewriting the bass.\n\n```strudel\nbass: note("c1 ~');
    expect(prose).toBe('Rewriting the bass.');
    expect(code).toBe('bass: note("c1 ~');
    expect(complete).toBe(false);
  });

  it('leaves a prose-only answer with no code — the miss the repair button covers', () => {
    const { prose, code } = splitReply('pickRestart restarts the chosen pattern from its own cycle zero.');
    expect(code).toBeNull();
    expect(prose).toContain('pickRestart');
  });
});

describe('readTruncation', () => {
  it('passes an untouched reply through', () => {
    expect(readTruncation('all done')).toEqual({ content: 'all done', truncated: false });
  });

  it('strips the marker and flags the cut-off', () => {
    expect(readTruncation(`half a doc${TRUNCATED_MARKER}`)).toEqual({ content: 'half a doc', truncated: true });
  });
});

describe('proposedDocument', () => {
  it('trims the fence padding and ends with exactly one newline', () => {
    expect(proposedDocument('\n\ns("bd sd")\n\n  ')).toBe('s("bd sd")\n');
  });
});
