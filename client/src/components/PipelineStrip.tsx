import { Fragment, useState } from "react";
import { useBoardStore } from "../store/boardStore.js";
import { BOX_TYPES } from "../types/index.js";
import { pipelineOrder, pipelineStepLabel } from "../lib/pipeline.js";
import { boxStatus, resolveBoxType } from "../lib/status.js";
import InputRulesPanel from "./InputRulesPanel.js";
import { ShieldCheck } from "./ui/ShieldCheck.js";

/**
 * Pipeline strip — the row of numbered step chips under the app bar.
 *
 * Each chip is one box on the board's main pipeline (inputs → workers →
 * custom boxes), in execution order (`pipelineOrder`), with its live status
 * from `boxStatus`: "1 Idea · Not run yet", "2 Brief · Done, reviewed", …
 * The strip is a read-only mirror of the canvas — clicking a chip does
 * nothing; the canvas stays the single place boxes are managed.
 *
 * Collaboration annotations (note/label/timer/checklist) and drawn Areas are
 * not pipeline steps and never appear here.
 */

const MAX_CHIPS = 6;

export default function PipelineStrip() {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const boxData = useBoardStore((s) => s.boxData);
  const [rulesOpen, setRulesOpen] = useState(false);

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

  // Data-safety note on the right (replaces the old lock/scope note). The
  // "Input rules" link opens the slide-over that spells the rules out.
  const rulesNote = (
    <div
      className="flex items-center gap-2 whitespace-nowrap"
      title="Synthetic or de-identified material only — open Input rules for details"
    >
      <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
      <span className="hidden md:inline text-[11px] text-slate-500">
        Synthetic or de-identified material only
      </span>
      <button
        type="button"
        onClick={() => setRulesOpen(true)}
        className="text-[11px] font-medium text-[#1a73e8] underline decoration-[#1a73e8]/30 underline-offset-2 transition hover:text-[#1667d6] hover:decoration-[#1a73e8]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/50 rounded"
        aria-haspopup="dialog"
      >
        Input rules
      </button>
    </div>
  );

  return (
    <>
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
        <div className="flex-shrink-0 pl-3">{rulesNote}</div>
      </div>

      <InputRulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}
