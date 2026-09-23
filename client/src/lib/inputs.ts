import type { Edge, Node } from "@xyflow/react";
import type { BoxData, NamedInput } from "../types.js";
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
