import type { Edge, Node } from "@xyflow/react";
import { resolveBoxType } from "./status.js";

/**
 * Board pipeline ordering — the single source of "what comes next" for the
 * pipeline strip under the header and for Run all (Header.tsx).
 *
 * Pipeline boxes are inputs (Idea/Image/Documents/Input), workers and custom
 * boxes; collaboration annotations (note/label/timer/checklist) and drawn
 * Areas are not steps of a pipeline, so they are excluded.
 *
 * `pipelineOrder` is a Kahn topological sort over the board's edges with a
 * canvas-position tiebreak (roots and equally-ready boxes run left → right,
 * which is how people lay pipelines out). Anything left over (a cycle) is
 * appended in canvas order so the result always contains every pipeline box.
 */
import { BOX_TYPES } from "../types/index.js";

export function isPipelineNode(node: Node): boolean {
  const type = resolveBoxType((node.data?.boxType || node.type) as string | undefined);
  if (!type) return false;
  const category = BOX_TYPES[type].category;
  return category === "input" || category === "worker" || category === "custom";
}

const byPosition = (a: Node, b: Node) =>
  a.position.x - b.position.x || a.position.y - b.position.y;

export function pipelineOrder(nodes: Node[], edges: Edge[]): Node[] {
  const pool = nodes.filter(isPipelineNode);
  const poolIds = new Set(pool.map((n) => n.id));
  const byId = new Map(pool.map((n) => [n.id, n]));

  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  pool.forEach((n) => indegree.set(n.id, 0));
  edges.forEach((e) => {
    if (!poolIds.has(e.source) || !poolIds.has(e.target)) return;
    if (e.source === e.target) return;
    indegree.set(e.target, (indegree.get(e.target) || 0) + 1);
    outgoing.set(e.source, [...(outgoing.get(e.source) || []), e.target]);
  });

  const ready = pool.filter((n) => (indegree.get(n.id) || 0) === 0).sort(byPosition);
  const done = new Set<string>();
  const ordered: Node[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    if (done.has(node.id)) continue;
    done.add(node.id);
    ordered.push(node);
    for (const target of outgoing.get(node.id) || []) {
      const next = (indegree.get(target) || 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        const targetNode = byId.get(target);
        if (targetNode) {
          ready.push(targetNode);
          ready.sort(byPosition);
        }
      }
    }
  }

  // Cycles (or nodes only reachable through one) fall back to canvas order.
  const leftover = pool.filter((n) => !done.has(n.id)).sort(byPosition);
  return [...ordered, ...leftover];
}

/** Short human name for a pipeline chip: "Handoff Brief Box" → "Handoff Brief". */
export function pipelineStepLabel(node: Node, fallback: string): string {
  const title = (node.data?.title as string) || fallback;
  return title.replace(/\s+Box$/, "");
}
