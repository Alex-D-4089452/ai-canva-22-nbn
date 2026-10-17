import { describe, expect, it } from "vitest";
import {
  coversAnotherBox,
  placeNewBox,
  viewportCenter,
  type PlaceableNode,
} from "./placement.js";

const SIZE = { width: 400, height: 250 };

function box(x: number, y: number, opts?: Partial<PlaceableNode>): PlaceableNode {
  return {
    type: "idea",
    position: { x, y },
    style: { width: 400, height: 250 },
    ...opts,
  };
}

describe("viewportCenter", () => {
  it("is the pane centre when nothing is panned or zoomed", () => {
    expect(viewportCenter([0, 0, 1], 1200, 800)).toEqual({ x: 600, y: 400 });
  });

  it("divides the pan offset out at zoom ≠ 1", () => {
    // screen = flow * zoom + translate  →  flow = (screen − translate)/zoom
    expect(viewportCenter([-300, -200, 2], 1200, 800)).toEqual({ x: 450, y: 300 });
  });

  it("treats a zero zoom as 1 to avoid dividing by zero", () => {
    expect(viewportCenter([10, 20, 0], 1000, 600)).toEqual({ x: 490, y: 280 });
  });
});

describe("placeNewBox", () => {
  it("returns null when the viewport centre is unknown", () => {
    expect(placeNewBox([], null, SIZE)).toBeNull();
  });

  it("centres the new box on the viewport centre", () => {
    const pos = placeNewBox([], { x: 600, y: 400 }, SIZE);
    expect(pos).toEqual({ x: 400, y: 275 }); // 600 − 400/2, 400 − 250/2
  });

  it("moves to the next free slot (right, then down) instead of stacking", () => {
    const first = placeNewBox([], { x: 600, y: 400 }, SIZE)!;
    const withFirst = [box(first.x, first.y)];
    const second = placeNewBox(withFirst, { x: 600, y: 400 }, SIZE)!;
    // right reads first
    expect(second).toEqual({ x: first.x + SIZE.width + 16, y: first.y });
    expect(coversAnotherBox(withFirst, second, SIZE)).toBe(false);

    const third = placeNewBox([...withFirst, box(second.x, second.y)], { x: 600, y: 400 }, SIZE)!;
    // then straight down from the centre
    expect(third).toEqual({ x: first.x, y: first.y + SIZE.height + 16 });
    expect(coversAnotherBox([...withFirst, box(second.x, second.y)], third, SIZE)).toBe(false);
  });

  it("fans out without overlap as more boxes pile up at the centre", () => {
    const nodes: PlaceableNode[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const next = placeNewBox(nodes, { x: 600, y: 400 }, SIZE)!;
      expect(coversAnotherBox(nodes, next, SIZE)).toBe(false);
      seen.add(`${next.x},${next.y}`);
      nodes.push(box(next.x, next.y));
    }
    expect(seen.size).toBe(8); // every box got its own slot
  });

  it("ignores areas — a box is meant to sit on them", () => {
    const area: PlaceableNode = {
      type: "area",
      position: { x: 300, y: 100 },
      style: { width: 2000, height: 1500 },
    };
    expect(placeNewBox([area], { x: 600, y: 400 }, SIZE)).toEqual({ x: 400, y: 275 });
  });

  it("still returns a position (the last step) when the board is packed", () => {
    const packed = Array.from({ length: 60 }, (_, i) => box(400 + (i % 6) * 120, 275 + Math.floor(i / 6) * 90));
    const pos = placeNewBox(packed, { x: 600, y: 400 }, SIZE);
    expect(pos).not.toBeNull();
  });
});

describe("coversAnotherBox", () => {
  it("reports a box at the same spot as covered", () => {
    expect(coversAnotherBox([box(400, 275)], { x: 400, y: 275 }, SIZE)).toBe(true);
  });

  it("reports a box far away as clear", () => {
    expect(coversAnotherBox([box(4000, 4000)], { x: 400, y: 275 }, SIZE)).toBe(false);
  });

  it("counts a small overlap as covered", () => {
    expect(coversAnotherBox([box(700, 275)], { x: 400, y: 275 }, SIZE)).toBe(true);
  });

  it("treats a node without a size as a point", () => {
    const chip: PlaceableNode = { type: "label", position: { x: 500, y: 300 } };
    expect(coversAnotherBox([chip], { x: 400, y: 275 }, SIZE)).toBe(true);
    expect(coversAnotherBox([{ ...chip, position: { x: 900, y: 700 } }], { x: 400, y: 275 }, SIZE)).toBe(false);
  });
});
