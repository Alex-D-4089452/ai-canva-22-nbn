import type { BoxData, BoxType } from "../types/index.js";
import { BOX_TYPES } from "../types/index.js";
import { runStatusLabel } from "./runStatus.js";

/**
 * Pure status pill/chip logic shared by the box's floating status pill
 * (BoxNode.tsx) and the pipeline strip under the header (PipelineStrip.tsx).
 *
 * Returns a tone (drives the pill/chip colors) plus a short human text — the
 * renderer decides which glyph (✓ / ○ / ⚠ / ●) to show, so both surfaces can
 * style the same state differently.
 */

export type StatusTone = "success" | "info" | "warning" | "danger" | "idle";

export interface BoxStatus {
  tone: StatusTone;
  text: string;
}

/** Legacy `summarize` spelling still exists on old boards. */
export function resolveBoxType(raw: string | undefined): BoxType | null {
  if (!raw) return null;
  const t = raw === "summarize" ? "summarise" : raw;
  return BOX_TYPES[t as BoxType] ? (t as BoxType) : null;
}

/** Upstream-gated boxes show "Not connected" until something feeds them. */
const UPSTREAM_ONE: BoxType[] = ["cartoon", "handoff", "jargon", "slides"];

function shortError(message: string): string {
  const oneLine = message.split("\n")[0].trim();
  return oneLine.length > 72 ? oneLine.slice(0, 71) + "…" : oneLine;
}

/** Same "has this box ever finished a run?" rule as the old status strip. */
export function hasRun(data: BoxData | undefined): boolean {
  if (!data) return false;
  return (
    data.ranAt !== undefined ||
    data.handoffGeneratedAt !== undefined ||
    data.alignmentRanAt !== undefined ||
    data.status === "done"
  );
}

export function boxStatus(
  boxType: BoxType,
  data: BoxData | undefined,
  upstreamCount = 0
): BoxStatus {
  const d = data;

  // ---- Input boxes report on what has been uploaded / typed ----
  if (boxType === "idea") {
    return (d?.content || "").trim()
      ? { tone: "success", text: "Idea ready" }
      : { tone: "idle", text: "Type your idea" };
  }
  if (boxType === "image") {
    return d?.imageData
      ? { tone: "success", text: "Image uploaded" }
      : { tone: "idle", text: "No image yet" };
  }
  if (boxType === "documents") {
    const docs = d?.documents ?? [];
    if (docs.length === 0) return { tone: "idle", text: "No file yet" };
    const usable = docs.filter((doc) => !doc.error).length;
    if (usable < docs.length) {
      return { tone: "warning", text: `${usable} of ${docs.length} uploaded` };
    }
    return { tone: "success", text: `${docs.length} of ${docs.length} uploaded` };
  }
  if (boxType === "media") {
    const docs = d?.documents ?? [];
    if (docs.length > 0) {
      const usable = docs.filter((doc) => !doc.error).length;
      if (usable < docs.length) {
        return { tone: "warning", text: `${usable} of ${docs.length} uploaded` };
      }
      return { tone: "success", text: `${docs.length} of ${docs.length} uploaded` };
    }
    if (d?.imageData) return { tone: "success", text: "Image uploaded" };
    if ((d?.content || "").trim()) return { tone: "success", text: "Idea typed" };
    return { tone: "idle", text: "No input yet" };
  }

  // ---- Worker / custom boxes report on their run lifecycle ----
  if (d?.status === "running") return { tone: "info", text: "Running…" };
  if (d?.status === "error" && d.error) {
    return { tone: "danger", text: `⚠ ${shortError(d.error)}` };
  }
  if (hasRun(d)) {
    return d?.status === "done"
      ? { tone: "success", text: "Done" }
      : { tone: "success", text: runStatusLabel(d?.ranAt, true) };
  }
  if (boxType === "alignment" && upstreamCount < 2) {
    return {
      tone: "warning",
      text: `Not run yet · has ${upstreamCount} of 2 inputs`,
    };
  }
  if (UPSTREAM_ONE.includes(boxType) && upstreamCount < 1) {
    return { tone: "warning", text: "Not connected" };
  }
  return { tone: "idle", text: "Not run yet" };
}
