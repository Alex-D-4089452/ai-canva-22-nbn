import Reveal from "./Reveal.js";

const STEPS = [
  {
    n: 1,
    title: "Place boxes",
    body: "Drop Idea, Research, PRD, UI Design and more onto a canvas. Each box is one focused AI step with a clear input and output.",
    circle: "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950",
  },
  {
    n: 2,
    title: "Connect them",
    body: "Draw edges to chain boxes into a pipeline. Content flows box-to-box, and prompts reference upstream outputs by name.",
    circle: "bg-blue-600 text-white",
  },
  {
    n: 3,
    title: "Run and review",
    body: "Hit run and watch research become a PRD, then a working React prototype — previewed right in the box, ready to edit.",
    circle: "bg-emerald-500 text-zinc-950",
  },
];

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
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
