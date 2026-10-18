import { Fragment } from "react";
import { useBoardStore } from "../store/boardStore.js";
import { BOX_TYPES } from "../types/index.js";
import { pipelineOrder, pipelineStepLabel } from "../lib/pipeline.js";
import { boxStatus, resolveBoxType } from "../lib/status.js";

/**
 * Pipeline strip — the row of numbered step chips under the app bar.
 *
 * Each chip is one box on the board's main pipeline (inputs → workers →
 * custom boxes), in execution order (`pipelineOrder`), with its live status
 * from `boxStatus`: "1 Idea · Not run yet", "2 Brief · Done", … The strip is
 * a read-only mirror of the canvas — clicking a chip does nothing; the
 * canvas stays the single place boxes are managed.
 *
 * Collaboration annotations (note/label/timer/checklist) and drawn Areas are
 * not pipeline steps and never appear here.
 */

const MAX_CHIPS = 6;

export default function PipelineStrip() {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const boxData = useBoardStore((s) => s.boxData);
  const collaborators = useBoardStore((s) => s.collaborators);

  const ordered = pipelineOrder(nodes, edges);
  const shown = ordered.slice(0, MAX_CHIPS);

  const chips = shown.map((node, index) => {
    const type = resolveBoxType((node.data?.boxType || node.type) as string | undefined)!;
    const upstream = new Set(
      edges.filter((e) => e.target === node.id).map((e) => e.source)
    ).size;
    const status = boxStatus(type, boxData[node.id], upstream);
    const data = boxData[node.id];
    const done = status.tone === "success";
    const active = data?.status === "running";
    return {
      key: node.id as string,
      number: index + 1,
      label: pipelineStepLabel(node, BOX_TYPES[type].label),
      text: status.text,
      tone: status.tone,
      done,
      active,
    };
  });

  // A dash of honest context on the right (the mock's "…only" note slot).
  const scopeNote =
    collaborators.length > 0
      ? "🔒 Shared with your team · updates live"
      : "🔒 Private to you · changes auto-save";

  return (
    <div className="pipeline-strip">
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto">
        {chips.map((chip, i) => (
          <Fragment key={chip.key}>
            {i > 0 && <span className="strip-connector" aria-hidden="true" />}
            <div
              className={"strip-chip strip-tone-" + chip.tone}
              title={chip.label + " — " + chip.text}
            >
              <span className={"strip-num" + (chip.done ? " strip-num-done" : "")}>
                {chip.done ? "✓" : chip.number}
              </span>
              <span className="font-semibold">{chip.label}</span>
              <span className="opacity-50">·</span>
              <span className="strip-status">{chip.text}</span>
            </div>
          </Fragment>
        ))}
        {ordered.length > MAX_CHIPS && (
          <span className="text-[11px] text-slate-400 whitespace-nowrap pl-1">
            +{ordered.length - MAX_CHIPS} more
          </span>
        )}
        {chips.length === 0 && (
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            Add an Input box to start a pipeline.
          </span>
        )}
      </div>
      <div className="hidden lg:block flex-shrink-0 text-[11px] text-slate-400 pl-3">
        {scopeNote}
      </div>
    </div>
  );
}
