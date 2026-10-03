import type { Edge, Node } from "@xyflow/react";
import type { BoxData, BoxType, NamedInput } from "../types.js";
import { BOX_TYPES } from "../types.js";
import { buildDocumentsOutput } from "./documents.js";
import { getBoxOutput } from "./prompts.js";

export interface CollectedInputs {
  namedInputs: NamedInput[];
  inputImage?: string;
}

/**
 * Text an Image box contributes to a text prompt when it has no other output.
 * HTTP(S) URLs are passed through so the model can reference the image; a
 * local data URL is summarized (never inlined — base64 would blow the prompt).
 */
export function imageReferenceText(imageData: string): string {
  if (/^https?:\/\//i.test(imageData)) return `[image: ${imageData}]`;
  return "[image attached: local only — not uploaded to storage]";
}

/**
 * Gathers upstream inputs for a box: walks incoming edges, collects text
 * outputs (documents boxes contribute their extracted-file text), the first
 * image URL (Cartoon image-to-image), and a labeled named input for
 * image-only sources so `{{inputs}}` / `{{Box Name}}` still resolve.
 * Also includes the box's own `content` so AI boxes work standalone — pass
 * `skipSelf: true` to exclude it (the Agent box uses this, since its
 * `content` is the task and travels in the context separately).
 */
export function collectInputs(
  nodes: Node[],
  edges: Edge[],
  boxData: Record<string, BoxData>,
  id: string,
  opts: { skipSelf?: boolean } = {}
): CollectedInputs {
  let inputImage: string | undefined;
  const namedInputs: NamedInput[] = [];

  const incomingEdges = edges.filter((e) => e.target === id);
  for (const edge of incomingEdges) {
    const sourceData = boxData[edge.source];
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceData) continue;
    const name = (sourceNode?.data?.title as string) || "Unnamed";

    if (sourceData.imageData && !inputImage) inputImage = sourceData.imageData;

    // Documents boxes derive their output from the extracted file text
    // (labeled by filename) — see lib/documents.ts.
    const textOutput = sourceData.documents?.length
      ? buildDocumentsOutput(sourceData.documents)
      : getBoxOutput(sourceData.output, sourceData.content);

    const parts: string[] = [];
    if (textOutput) parts.push(textOutput);
    // Image-only sources (Image box) have empty output/content — still push
    // a labeled entry so downstream text prompts know an image is connected.
    if (sourceData.imageData) parts.push(imageReferenceText(sourceData.imageData));

    if (parts.length) namedInputs.push({ name, output: parts.join("\n\n") });
  }

  if (!opts.skipSelf) {
    const data = boxData[id];
    const node = nodes.find((n) => n.id === id);
    // Also include this box's own content (lets AI boxes work standalone)
    if (data && data.content && data.content.trim()) {
      namedInputs.push({
        name: (node?.data?.title as string) || "This Box",
        output: data.content.trim(),
      });
    }
  }

  return { namedInputs, inputImage };
}

/**
 * Alignment Check compares two artefacts (`{{input_1}}` / `{{input_2}}`), so it
 * only runs once two DISTINCT upstream boxes are connected and each actually
 * contributes content (text, documents, or an image reference). Returns null
 * when the box may run, otherwise the user-facing reason (shown as the box's
 * error). The box's own `content` never counts (skipSelf).
 */
export function alignmentRunBlocker(
  nodes: Node[],
  edges: Edge[],
  boxData: Record<string, BoxData>,
  id: string
): string | null {
  const sources = new Set(
    edges.filter((e) => e.target === id).map((e) => e.source)
  );
  if (sources.size < 2) {
    return `Alignment Check needs two connected input boxes (found ${sources.size}) — connect a second artefact to compare.`;
  }
  const { namedInputs } = collectInputs(nodes, edges, boxData, id, {
    skipSelf: true,
  });
  if (namedInputs.length < 2) {
    return "Alignment Check needs two artefacts with content — run the connected boxes first so both contribute output.";
  }
  return null;
}

/** Boxes whose Run needs at least one connected upstream box (see runInputBlocker). */
const UPSTREAM_INPUT_BOXES: readonly BoxType[] = [
  "cartoon",
  "handoff",
  "decision",
  "slides",
];

/** What each upstream-gated box asks the user to connect (its placeholder says the same). */
const UPSTREAM_INPUT_HINT: Partial<Record<BoxType, string>> = {
  cartoon: "an Image or Idea box",
  handoff: "a box with source material (Research, PRD, …)",
  decision: "a box with meeting notes",
  slides: "a Research or Idea box",
};

/**
 * Run-time input gates: the input a box needs before it may run. Returns null
 * when the box may run, otherwise the user-facing reason (shown as the box's
 * error). Rules:
 * - `alignment`: two distinct upstream boxes, both contributing content;
 * - `cartoon` / `handoff` / `decision` / `slides`: at least one connected
 *   upstream box that actually contributes content;
 * - `code` / `ui` / `stitch`: a typed description (`content`) or one connected
 *   upstream box with content — the build-description field accepts either;
 * - `agent`: a typed task (its own `content`);
 * - every other box: no gate — stock prompts are designed to run standalone.
 * `runBox` applies this BEFORE any model call (and before the box flips to
 * "running"); BoxNode mirrors it by disabling ▶ Run with a tooltip naming
 * what's missing. Documents/Image boxes have no Run at all — their upload
 * already gates downstream use.
 */
export function runInputBlocker(
  boxType: BoxType,
  nodes: Node[],
  edges: Edge[],
  boxData: Record<string, BoxData>,
  id: string
): string | null {
  if (boxType === "alignment") {
    return alignmentRunBlocker(nodes, edges, boxData, id);
  }

  if (UPSTREAM_INPUT_BOXES.includes(boxType)) {
    const label = BOX_TYPES[boxType].label;
    if (!edges.some((e) => e.target === id)) {
      return `${label} needs an input — connect ${
        UPSTREAM_INPUT_HINT[boxType] || "an upstream box"
      }.`;
    }
    const { namedInputs } = collectInputs(nodes, edges, boxData, id, {
      skipSelf: true,
    });
    if (namedInputs.length < 1) {
      return `${label} needs an input with content: run/give input to the connected box first.`;
    }
    return null;
  }

  // Build boxes: their own typed description counts as the input (no
  // skipSelf), so "description OR connected upstream with content".
  if (boxType === "code" || boxType === "ui" || boxType === "stitch") {
    const { namedInputs } = collectInputs(nodes, edges, boxData, id);
    if (namedInputs.length < 1) {
      return `${BOX_TYPES[boxType].label} needs a description — type what you want to build, or connect an upstream box.`;
    }
    return null;
  }

  if (boxType === "agent") {
    if (!(boxData[id]?.content || "").trim()) {
      return "Agent needs a task — type what you want it to do, then click Run.";
    }
    return null;
  }

  return null;
}
