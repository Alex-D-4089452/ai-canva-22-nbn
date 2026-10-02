/**
 * The line-diff engine shared by the UI Design box's version history
 * (client/src/components/CodeChangePanel.tsx).
 *
 * The contract this came from still holds: the APP computes the diff, the model
 * never writes one, so what the human reviews is exactly what the numbers say.
 *
 * Everything here is deterministic and unit-tested (src/lib/diff.test.ts).
 */

export type DiffOp = { type: " " | "-" | "+"; line: string };

/** Above this many lines, skip the exact diff and report a whole-file replace. */
const MAX_DIFF_LINES = 4_000;

/**
 * Splits text into lines the way a diff does: a trailing newline TERMINATES the
 * last line instead of creating an empty one ("a\nb\n" is two lines).
 */
function splitLines(text: string): string[] {
  if (!text) return [];
  return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
}

/**
 * Internal sentinel marking "the last line of this text has no newline".
 *
 * git treats a missing final newline as part of the line's content, so a line
 * whose newline status changes is not "unchanged" — without this, a diff would
 * claim a context line that git itself considers different.
 */
const NO_NEWLINE = "\u0000";

function diffLines(text: string): string[] {
  const lines = splitLines(text);
  if (lines.length > 0 && !text.endsWith("\n")) lines[lines.length - 1] += NO_NEWLINE;
  return lines;
}

/** LCS line diff (falls back to a coarse replace for very large files). */
export function computeLineDiff(before: string, after: string): DiffOp[] {
  const a = diffLines(before);
  const b = diffLines(after);
  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    return [
      ...a.map((line) => ({ type: "-" as const, line })),
      ...b.map((line) => ({ type: "+" as const, line })),
    ];
  }

  // LCS table (rolling rows to keep memory sane).
  const m = a.length;
  const n = b.length;
  const table: Uint32Array[] = [];
  for (let i = 0; i <= m; i++) table.push(new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: " ", line: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ type: "-", line: a[i] });
      i++;
    } else {
      ops.push({ type: "+", line: b[j] });
      j++;
    }
  }
  while (i < m) ops.push({ type: "-", line: a[i++] });
  while (j < n) ops.push({ type: "+", line: b[j++] });
  // The sentinel has done its job (it decided the comparison) — never let it
  // reach the screen.
  return ops.map((op) => ({ type: op.type, line: op.line.replace(/\u0000$/, "") }));
}

/** Added/removed line counts for a version badge. */
export function lineDiff(before: string, after: string): { added: number; removed: number } {
  const ops = computeLineDiff(before, after);
  return {
    added: ops.filter((o) => o.type === "+").length,
    removed: ops.filter((o) => o.type === "-").length,
  };
}
