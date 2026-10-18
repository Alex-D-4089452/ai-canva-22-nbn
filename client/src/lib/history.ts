/**
 * Pure undo/redo logic for the board.
 *
 * A board edit is recorded as a SNAPSHOT of the state to go back to — nodes /
 * edges / boxData / boardTitle are immutable in the store, so a snapshot is
 * just four references and costs nothing to keep. `boardStore` owns the live
 * stacks (`history`, `historyBaseline`) and calls these helpers:
 *
 * - `boardChangeKind(prev, next)` classifies what a change touched, so a burst
 *   of same-kind edits (typing in a box, dragging a node) can be collapsed
 *   into ONE undo step and pure selection changes are ignored entirely.
 * - `recordHistoryEntry` pushes the pre-edit snapshot (coalescing + trimming).
 * - `undoFrom` / `redoFrom` walk the stacks and hand back the state to apply.
 *
 * History is board-scoped, in-memory only (never persisted), and reset on any
 * board switch by the store.
 */

import type { Edge, Node } from "@xyflow/react";
import type { BoxData } from "../types/index.js";

/** The board content an undo step can restore. */
export interface BoardSnapshot {
  nodes: Node[];
  edges: Edge[];
  boxData: Record<string, BoxData>;
  boardTitle: string;
}

/**
 * What a change touched, in recording priority order:
 * - `topology` — a box/edge was added or removed (never coalesced: each one is
 *   its own undo step, however fast they arrive);
 * - `node` — an existing box changed (moved, resized, renamed, recolored area);
 * - `data` — box content changed (typed text, output, checklist…);
 * - `title` — the board title changed.
 * `null` means "nothing worth undoing" (selection only).
 */
export type ChangeKind = "topology" | "node" | "data" | "title";

export interface HistoryEntry {
  /** State to restore — the board as it was BEFORE the edit. */
  snapshot: BoardSnapshot;
  kind: ChangeKind;
  /** When it was recorded; drives coalescing. */
  at: number;
}

export interface HistoryStack {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

export const EMPTY_HISTORY: HistoryStack = { undo: [], redo: [] };

/** Steps kept in each direction — boards are small, this is plenty. */
export const MAX_HISTORY_ENTRIES = 50;

/**
 * Two same-kind edits closer together than this collapse into one step: one
 * Ctrl+Z takes back a whole typing burst (or a whole drag), not one keystroke.
 */
export const HISTORY_COALESCE_MS = 800;

/**
 * BoxData keys that are RUN BOOKKEEPING rather than an edit of their own:
 * status flips, the error line, the "Ran at" stamp and token counts. A patch
 * touching only these is not an undo step on its own — it stays folded into
 * the step that produced the real content change (the generation itself), so
 * undoing a run takes the box back to "not run" instead of stranding it in a
 * half-run state.
 */
export const TRANSIENT_BOX_DATA_KEYS = ["status", "error", "ranAt", "tokens"];

export function isTransientPatch(patch: Record<string, unknown>): boolean {
  const keys = Object.keys(patch);
  return (
    keys.length > 0 && keys.every((k) => TRANSIENT_BOX_DATA_KEYS.includes(k))
  );
}

/** What (if anything) changed between two board states. */
export function boardChangeKind(
  prev: BoardSnapshot,
  next: BoardSnapshot
): ChangeKind | null {
  if (prev.nodes.length !== next.nodes.length) return "topology";
  if (prev.edges.length !== next.edges.length) return "topology";
  if (!sameNodeIds(prev.nodes, next.nodes)) return "topology";
  if (!sameEdgeIds(prev.edges, next.edges)) return "topology";
  if (nodesChangedBeyondSelection(prev.nodes, next.nodes)) return "node";
  if (prev.boxData !== next.boxData) return "data";
  if (prev.boardTitle !== next.boardTitle) return "title";
  return null;
}

/**
 * Push a pre-edit snapshot. Same-kind edits inside `HISTORY_COALESCE_MS` of the
 * last step are dropped (the older pre-state already covers the whole burst) —
 * except topology, where every added/removed box stays its own step however
 * fast it arrives. A new step always clears the redo stack, like every other
 * editor.
 */
export function recordHistoryEntry(
  stack: HistoryStack,
  pre: BoardSnapshot,
  kind: ChangeKind,
  now: number
): HistoryStack {
  const last = stack.undo[stack.undo.length - 1];
  if (
    kind !== "topology" &&
    last &&
    last.kind === kind &&
    now - last.at < HISTORY_COALESCE_MS
  ) {
    return { undo: stack.undo, redo: [] };
  }
  const undo = [...stack.undo, { snapshot: pre, kind, at: now }];
  while (undo.length > MAX_HISTORY_ENTRIES) undo.shift();
  return { undo, redo: [] };
}

/** Step back. `current` is stashed so the step can be redone. */
export function undoFrom(
  stack: HistoryStack,
  current: BoardSnapshot,
  now: number
): { stack: HistoryStack; restored: BoardSnapshot } | null {
  if (stack.undo.length === 0) return null;
  const undo = [...stack.undo];
  const entry = undo.pop()!;
  // Close the coalescing window: the next edit must start a NEW step instead
  // of merging into the one we just walked back out of.
  if (undo.length > 0) {
    undo[undo.length - 1] = { ...undo[undo.length - 1], at: Number.NEGATIVE_INFINITY };
  }
  const redo = trimHistory([
    ...stack.redo,
    { snapshot: current, kind: entry.kind, at: now },
  ]);
  return { stack: { undo, redo }, restored: entry.snapshot };
}

/** Step forward again. */
export function redoFrom(
  stack: HistoryStack,
  current: BoardSnapshot,
  now: number
): { stack: HistoryStack; restored: BoardSnapshot } | null {
  if (stack.redo.length === 0) return null;
  const redo = [...stack.redo];
  const entry = redo.pop()!;
  const undo = trimHistory([
    ...stack.undo,
    { snapshot: current, kind: entry.kind, at: now },
  ]);
  return { stack: { undo, redo }, restored: entry.snapshot };
}

function trimHistory(entries: HistoryEntry[]): HistoryEntry[] {
  while (entries.length > MAX_HISTORY_ENTRIES) entries.shift();
  return entries;
}

function sameNodeIds(a: Node[], b: Node[]): boolean {
  const ids = new Set(a.map((n) => n.id));
  return b.every((n) => ids.has(n.id));
}

function sameEdgeIds(a: Edge[], b: Edge[]): boolean {
  const ids = new Set(a.map((e) => e.id));
  return b.every((e) => ids.has(e.id));
}

/**
 * True when any node changed beyond React Flow's `selected` flag — clicking a
 * box must never create an undo step that does nothing visible.
 */
function nodesChangedBeyondSelection(a: Node[], b: Node[]): boolean {
  if (a.length !== b.length) return true;
  return b.some((node, i) => {
    const prev = a[i];
    if (prev.id !== node.id) return true;
    if (prev.type !== node.type) return true;
    if (prev.position.x !== node.position.x || prev.position.y !== node.position.y)
      return true;
    if ((prev.style?.width ?? null) !== (node.style?.width ?? null)) return true;
    if ((prev.style?.height ?? null) !== (node.style?.height ?? null)) return true;
    // Node data holds the static bits (title, custom color…); the store always
    // spreads a fresh object when it edits one.
    if (prev.data !== node.data) return true;
    return false;
  });
}
