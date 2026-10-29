/**
 * Write an AI-proposed document into the editor.
 *
 * One transaction tagged `ai.patch`, so the editor's update listener clears the
 * stale highlight marks and re-evaluates immediately, `EditorScreen` persists
 * it, and the whole rewrite reverts with a single Cmd+Z.
 */
import { getEngine } from '@/lib/strudel/engine';
import { writeSource } from '@/lib/strudel/codemirror/writeback';
import { docParses, firstEditablePos, detectAllChunks } from '@/lib/strudel/chunks/detect';

export interface ApplyResult {
  ok: boolean;
  /** the proposal has a JS syntax error — applied anyway, but worth saying so */
  broken?: boolean;
  reason?: string;
}

export function applyProposal(code: string): ApplyResult {
  const engine = getEngine();
  if (!engine) return { ok: false, reason: 'the editor is not mounted' };

  const view = engine.view;
  const current = view.state.doc.toString();
  if (current === code) return { ok: false, reason: 'the document already matches this proposal' };

  // land the cursor on the first editable pattern of the NEW doc, in the same
  // transaction — a whole-document replace would otherwise map the selection
  // to the end and leave the side panel with nothing to edit
  const cursor = firstEditablePos(code) ?? detectAllChunks(code)[0]?.statementRange[0] ?? 0;

  view.dispatch({
    changes: { from: 0, to: current.length, insert: code },
    selection: { anchor: Math.min(cursor, code.length) },
    annotations: writeSource.of('ai.patch'),
  });

  return { ok: true, broken: !docParses(code) };
}
