import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { BoxData } from "../types/index.js";
import {
  EMPTY_HISTORY,
  HISTORY_COALESCE_MS,
  MAX_HISTORY_ENTRIES,
  boardChangeKind,
  isTransientPatch,
  recordHistoryEntry,
  redoFrom,
  undoFrom,
  type BoardSnapshot,
} from "./history.js";

function snap(partial?: Partial<BoardSnapshot>): BoardSnapshot {
  return {
    nodes: [],
    edges: [],
    boxData: {},
    boardTitle: "Untitled Board",
    ...partial,
  };
}

function node(id: string, opts?: Partial<Node>): Node {
  return {
    id,
    type: "idea",
    position: { x: 0, y: 0 },
    data: { boxType: "idea" },
    ...opts,
  } as Node;
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

describe("isTransientPatch", () => {
  it("recognises run bookkeeping as non-editable on its own", () => {
    expect(isTransientPatch({ status: "running", error: undefined })).toBe(true);
    expect(isTransientPatch({ ranAt: 123 })).toBe(true);
    expect(isTransientPatch({ tokens: { totalTokens: 10 } })).toBe(true);
  });

  it("treats real content (and empty) patches as edits", () => {
    expect(isTransientPatch({ output: "hello" })).toBe(false);
    expect(isTransientPatch({ output: "hello", status: "done" })).toBe(false);
    expect(isTransientPatch({})).toBe(false);
  });
});

describe("boardChangeKind", () => {
  it("ignores an unchanged board and a pure selection change", () => {
    const n = node("a");
    const a = snap({ nodes: [n] });
    expect(boardChangeKind(a, a)).toBeNull();

    const selected = snap({
      nodes: [{ ...n, selected: true } as Node],
      boxData: a.boxData,
    });
    expect(boardChangeKind(a, selected)).toBeNull();
  });

  it("calls an added box (or edge) a topology change", () => {
    const before = snap({ nodes: [node("a")] });
    expect(
      boardChangeKind(before, snap({ nodes: [node("a"), node("b")] }))
    ).toBe("topology");
    expect(
      boardChangeKind(before, snap({ nodes: [node("a")], edges: [edge("e", "a", "b")] }))
    ).toBe("topology");
  });

  it("calls a move, resize or rename a node change", () => {
    const before = snap({ nodes: [node("a")] });
    expect(
      boardChangeKind(
        before,
        snap({ nodes: [{ ...node("a"), position: { x: 40, y: 12 } } as Node] })
      )
    ).toBe("node");
    expect(
      boardChangeKind(
        before,
        snap({ nodes: [{ ...node("a"), style: { width: 500 } } as Node] })
      )
    ).toBe("node");
    expect(
      boardChangeKind(
        before,
        snap({ nodes: [{ ...node("a"), data: { boxType: "idea", title: "Renamed" } } as Node] })
      )
    ).toBe("node");
  });

  it("separates box data from the board title", () => {
    const n = node("a");
    const before = snap({ nodes: [n], boxData: { a: {} as BoxData } });
    expect(
      boardChangeKind(
        before,
        snap({ nodes: [n], boxData: { a: { content: "hi" } as BoxData } })
      )
    ).toBe("data");
    expect(
      boardChangeKind(before, snap({ nodes: [n], boxData: before.boxData, boardTitle: "Renamed" }))
    ).toBe("title");
  });
});

describe("recordHistoryEntry", () => {
  const base = snap();

  it("keeps distinct steps and clears the redo stack", () => {
    const withRedo = { undo: [], redo: [{ snapshot: base, kind: "data" as const, at: 0 }] };
    const s = recordHistoryEntry(withRedo, base, "data", 1000);
    expect(s.undo).toHaveLength(1);
    expect(s.redo).toHaveLength(0);
    expect(s.undo[0].snapshot).toBe(base);
  });

  it("coalesces a same-kind burst into ONE step", () => {
    let s = recordHistoryEntry(EMPTY_HISTORY, base, "data", 1000);
    s = recordHistoryEntry(s, base, "data", 1000 + HISTORY_COALESCE_MS - 1);
    expect(s.undo).toHaveLength(1); // the older pre-state covers the burst

    s = recordHistoryEntry(s, base, "data", 1000 + HISTORY_COALESCE_MS + 1);
    expect(s.undo).toHaveLength(2); // past the window → its own step
  });

  it("never coalesces across kinds, nor a topology change with anything", () => {
    let s = recordHistoryEntry(EMPTY_HISTORY, base, "data", 1000);
    s = recordHistoryEntry(s, base, "title", 1001);
    expect(s.undo).toHaveLength(2);

    s = recordHistoryEntry(s, base, "topology", 1002);
    s = recordHistoryEntry(s, base, "topology", 1003); // back-to-back adds
    expect(s.undo).toHaveLength(4);
  });

  it("drops the oldest steps past the cap", () => {
    let s = EMPTY_HISTORY;
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i++) {
      // spread beyond the coalesce window so each push is its own step
      s = recordHistoryEntry(s, snap({ boardTitle: `t${i}` }), "title", i * 10_000);
    }
    expect(s.undo).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(s.undo[0].snapshot.boardTitle).toBe("t5");
    expect(s.undo[s.undo.length - 1].snapshot.boardTitle).toBe(`t${MAX_HISTORY_ENTRIES + 4}`);
  });
});

describe("undoFrom / redoFrom", () => {
  it("is a no-op on an empty history", () => {
    expect(undoFrom(EMPTY_HISTORY, snap(), 0)).toBeNull();
    expect(redoFrom(EMPTY_HISTORY, snap(), 0)).toBeNull();
  });

  it("round-trips a step: undo restores it, redo brings the edit back", () => {
    const before = snap({ boardTitle: "Before" });
    const after = snap({ boardTitle: "After" });
    const s = recordHistoryEntry(EMPTY_HISTORY, before, "title", 1000);

    const undone = undoFrom(s, after, 2000)!;
    expect(undone.restored).toBe(before);
    expect(undone.stack.undo).toHaveLength(0);
    expect(undone.stack.redo[0].snapshot).toBe(after);

    const redone = redoFrom(undone.stack, before, 3000)!;
    expect(redone.restored).toBe(after);
    expect(redone.stack.undo).toHaveLength(1);
    expect(redone.stack.redo).toHaveLength(0);
  });

  it("stops coalescing into a step the moment it has been undone", () => {
    // title @0, data @50 (different kinds → own steps), then undo the data one.
    let s = recordHistoryEntry(EMPTY_HISTORY, snap(), "title", 0);
    s = recordHistoryEntry(s, snap(), "data", 50);
    const undone = undoFrom(s, snap(), 100)!;

    // A fresh title edit @150 sits INSIDE the old window of the title step.
    // It must still get its own step instead of merging back into it.
    s = recordHistoryEntry(undone.stack, snap(), "title", 150);
    expect(s.undo).toHaveLength(2);
  });

  it("keeps both stacks inside the cap", () => {
    let s = EMPTY_HISTORY;
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 3; i++) {
      s = recordHistoryEntry(s, snap({ boardTitle: `t${i}` }), "title", i * 10_000);
    }
    let stack = s;
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 3; i++) {
      const step = undoFrom(stack, snap(), 1_000_000 + i * 10_000);
      if (!step) break;
      stack = step.stack;
    }
    expect(stack.undo).toHaveLength(0);
    expect(stack.redo.length).toBeLessThanOrEqual(MAX_HISTORY_ENTRIES);
  });
});
