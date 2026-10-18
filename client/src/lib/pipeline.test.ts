import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { isPipelineNode, pipelineOrder, pipelineStepLabel } from "./pipeline.js";

function node(
  id: string,
  type: string,
  x: number,
  extra?: Record<string, unknown>
): Node {
  return {
    id,
    type,
    position: { x, y: 0 },
    data: { boxType: type, title: `${type} ${id}`, ...extra },
  } as Node;
}

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe("isPipelineNode", () => {
  it("keeps inputs/workers/custom and drops collab + areas", () => {
    expect(isPipelineNode(node("a", "idea", 0))).toBe(true);
    expect(isPipelineNode(node("a", "research", 0))).toBe(true);
    expect(isPipelineNode(node("a", "custom", 0))).toBe(true);
    expect(isPipelineNode(node("a", "note", 0))).toBe(false);
    expect(isPipelineNode(node("a", "timer", 0))).toBe(false);
    expect(isPipelineNode(node("a", "checklist", 0))).toBe(false);
    expect(isPipelineNode(node("a", "area", 0))).toBe(false);
    // legacy spelling resolves too
    expect(isPipelineNode(node("a", "summarize", 0))).toBe(true);
  });
});

describe("pipelineOrder", () => {
  it("orders by edges, not by canvas x (downstream stays downstream)", () => {
    const nodes = [
      node("research", "research", 100),
      node("idea", "idea", 500), // sits to the RIGHT but feeds the research box
    ];
    const ordered = pipelineOrder(nodes, [edge("idea", "research")]);
    expect(ordered.map((n) => n.id)).toEqual(["idea", "research"]);
  });

  it("sorts independent roots left to right and keeps chains together", () => {
    const nodes = [
      node("prd", "prd", 700),
      node("summary", "summarise", 400),
      node("idea2", "idea", 300),
      node("idea1", "idea", 50),
    ];
    const edges = [edge("idea2", "summary"), edge("idea1", "prd")];
    const ordered = pipelineOrder(nodes, edges).map((n) => n.id);
    expect(ordered.indexOf("idea1")).toBeLessThan(ordered.indexOf("prd"));
    expect(ordered.indexOf("idea2")).toBeLessThan(ordered.indexOf("summary"));
    expect(ordered.indexOf("idea1")).toBeLessThan(ordered.indexOf("idea2"));
  });

  it("excludes collaboration boxes and areas entirely", () => {
    const nodes = [
      node("note", "note", 0),
      node("timer", "timer", 10),
      node("area", "area", 20),
      node("idea", "idea", 30),
    ];
    expect(pipelineOrder(nodes, []).map((n) => n.id)).toEqual(["idea"]);
  });

  it("still returns cycle members in canvas order", () => {
    const nodes = [node("b", "research", 10), node("a", "research", 0)];
    const ordered = pipelineOrder(nodes, [edge("a", "b"), edge("b", "a")]).map((n) => n.id);
    expect(ordered.sort()).toEqual(["a", "b"]);
  });

  it("ignores edges pointing outside the pipeline pool", () => {
    const nodes = [node("research", "research", 0)];
    expect(pipelineOrder(nodes, [edge("note", "research")]).map((n) => n.id)).toEqual([
      "research",
    ]);
  });
});

describe("pipelineStepLabel", () => {
  it("drops the trailing ' Box' from a title and falls back to the given label", () => {
    const n = node("h", "handoff", 0, { title: "Handoff Brief Box" });
    expect(pipelineStepLabel(n, "Handoff Brief")).toBe("Handoff Brief");
    const untitled = node("h", "handoff", 0, { title: "" });
    expect(pipelineStepLabel(untitled, "Handoff Brief")).toBe("Handoff Brief");
  });
});
