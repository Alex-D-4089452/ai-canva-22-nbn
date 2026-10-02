import { describe, expect, it } from "vitest";
import { computeLineDiff, lineDiff } from "./diff.js";

describe("lineDiff", () => {
  it("counts added and removed lines", () => {
    expect(lineDiff("a\nb\nc\n", "a\nB\nc\n")).toEqual({ added: 1, removed: 1 });
    expect(lineDiff("a\n", "a\nb\n")).toEqual({ added: 1, removed: 0 });
    expect(lineDiff("a\nb\n", "a\n")).toEqual({ added: 0, removed: 1 });
    expect(lineDiff("same\n", "same\n")).toEqual({ added: 0, removed: 0 });
    expect(lineDiff("", "a\nb\n")).toEqual({ added: 2, removed: 0 });
  });

  it("treats a missing final newline as a change (git does)", () => {
    expect(lineDiff("a\nb", "a\nb\n")).toEqual({ added: 1, removed: 1 });
    expect(lineDiff("a\nb\n", "a\nb")).toEqual({ added: 1, removed: 1 });
  });
});

describe("computeLineDiff", () => {
  it("produces a readable operation list", () => {
    expect(computeLineDiff("a\nb\nc\n", "a\nc\nd\n")).toEqual([
      { type: " ", line: "a" },
      { type: "-", line: "b" },
      { type: " ", line: "c" },
      { type: "+", line: "d" },
    ]);
  });

  it("returns only context lines for identical content", () => {
    expect(computeLineDiff("a\nb\n", "a\nb\n")).toEqual([
      { type: " ", line: "a" },
      { type: " ", line: "b" },
    ]);
  });

  it("falls back to a whole-file replace above the line cap", () => {
    const big = Array.from({ length: 5_000 }, (_, i) => `line${i}`).join("\n");
    const ops = computeLineDiff(big, big + "\nmore");
    expect(ops.every((op) => op.type === "-" || op.type === "+")).toBe(true);
  });
});
