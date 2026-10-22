import ReviewerChip from "../ui/ReviewerChip.js";
import Reveal from "./Reveal.js";

/**
 * "How it works" — three numbered steps with a dashed connector.
 *
 * Steps 2 and 3 carry the app's status vocabulary as illustrative chips
 * (Not run yet / Running / Done / Needs re-run) and the reviewed-by pill.
 * The Handoff Brief box now implements the same chip for real (see
 * components/ui/ReviewerChip.tsx); this section stays static marketing UI.
 */

type ChipTone = "idle" | "running" | "done" | "warning";

interface StatusChip {
  tone: ChipTone;
  label: string;
}

interface Step {
  n: number;
  title: string;
  body: string;
  circle: string;
  chips?: StatusChip[];
  reviewedBy?: { name: string; time: string };
}

const STEPS: Step[] = [
  {
    n: 1,
    title: "Place boxes",
    body: "Drop Idea, Research, PRD, UI Design and more onto a canvas. Each box is one focused AI step with a clear input and output.",
    circle: "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950",
  },
  {
    n: 2,
    title: "Connect them",
    body: "Draw a line between boxes, or pick from a list. Content flows from one box to the next, and each box shows where it's up to.",
    circle: "bg-blue-600 text-white",
    chips: [
      { tone: "idle", label: "Not run yet" },
      { tone: "running", label: "Running" },
      { tone: "done", label: "Done" },
      { tone: "warning", label: "Needs re-run" },
    ],
  },
  {
    n: 3,
    title: "Run and review",
    body: "Run the pipeline, read each result full size and mark it reviewed before you share it.",
    circle: "bg-emerald-500 text-zinc-950",
    reviewedBy: { name: "Sophie D.", time: "6:58 pm" },
  },
];

/** Chip chrome per tone (light + dark theme). */
const CHIP_TONE: Record<ChipTone, string> = {
  idle: "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400",
  running:
    "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-400/25 dark:bg-indigo-400/10 dark:text-indigo-300",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
};

/** Glyph shown before each chip's label — matches the canvas status pills. */
function ChipGlyph({ tone }: { tone: ChipTone }) {
  if (tone === "running") {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
        <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "done") {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d="m4.5 12.5 5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5" strokeLinecap="round" />
        <circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <Reveal className="max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              No code required to start. Build a visual pipeline in three steps.
            </p>
          </Reveal>

          <Reveal delay={120} className="hidden lg:block">
            <div className="max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <span className="mr-1">💡</span>
                If you can draw an arrow, you can build a pipeline — prompts
                reference upstream boxes by name.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 120}>
              <div className="flex items-center gap-4">
                <span
                  className={
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold " +
                    step.circle
                  }
                >
                  {step.n}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="hidden h-px flex-1 border-t border-dashed border-slate-300 md:block dark:border-white/20" />
                )}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {step.body}
              </p>

              {step.chips && (
                <div className="mt-4 flex max-w-sm flex-wrap gap-1.5">
                  {step.chips.map((chip) => (
                    <span
                      key={chip.label}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none " +
                        CHIP_TONE[chip.tone]
                      }
                    >
                      <ChipGlyph tone={chip.tone} />
                      {chip.label}
                    </span>
                  ))}
                </div>
              )}

              {step.reviewedBy && (
                <div className="mt-4">
                  <ReviewerChip
                    name={step.reviewedBy.name}
                    time={step.reviewedBy.time}
                    className="max-w-sm"
                  />
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
