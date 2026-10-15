interface LandingHeroProps {
  onSignIn: () => void;
  signingIn: boolean;
}

/** Rows of the fake board shown in the hero mockup. */
const BOARD_ROWS = [
  { icon: "💡", label: "Idea", detail: "Plan a week of dinners", state: "done" },
  { icon: "🔍", label: "Research", detail: "Seasonal recipes, budget", state: "done" },
  { icon: "📄", label: "PRD", detail: "Meal planner · v1", state: "done" },
  { icon: "💻", label: "UI Design", detail: "Working React prototype", state: "running" },
] as const;

/** Live-presence rows on the floating card. */
const PRESENCE = [
  { name: "Ada", action: "editing Research" },
  { name: "Sam", action: "reviewing PRD" },
  { name: "You", action: "running UI Design" },
];

export default function LandingHero({ onSignIn, signingIn }: LandingHeroProps) {
  return (
    <section id="top" className="relative">
      <div className="mx-auto max-w-6xl px-5 pt-8 pb-16 md:pt-10">
        {/* Blue hero panel */}
        <div className="fade-in relative rounded-[32px] bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 p-8 shadow-[0_30px_80px_-40px_rgba(37,99,235,0.6)] md:p-12">
          {/* Organic darker-blue shape sweeping across the panel */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
            <div className="absolute -top-1/3 right-[-12%] h-[150%] w-[65%] rotate-[14deg] rounded-[46%] bg-blue-900/45 blur-xl" />
            <div className="absolute -bottom-1/2 left-[-15%] h-[110%] w-[45%] -rotate-[18deg] rounded-[48%] bg-blue-900/25 blur-2xl" />
          </div>

          <div className="relative grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
            {/* Copy */}
            <div>
              <div className="fade-in inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Visual AI pipelines · real-time collaboration
              </div>

              <h1 className="fade-in fade-in-delay-1 mt-5 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-[3.4rem]">
                Build AI pipelines visually, from idea to code
              </h1>

              <p className="fade-in fade-in-delay-2 mt-5 max-w-lg text-base leading-relaxed text-blue-100 md:text-lg">
                Place boxes on a canvas, connect them, and let AI content flow
                from research to PRD to a working prototype — together with your
                team.
              </p>

              <div className="fade-in fade-in-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={onSignIn}
                  disabled={signingIn}
                  className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-lg transition hover:bg-blue-50 disabled:opacity-60"
                >
                  {signingIn ? "Connecting…" : "Get started free"}
                </button>
                <a
                  href="#how-it-works"
                  className="rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* Product mockup collage */}
            <div className="fade-in fade-in-delay-4 relative">
              {/* Floating presence card */}
              <div className="float absolute -top-10 right-2 z-10 w-56 rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-2xl md:-top-12 md:right-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Workshop · live
                </p>
                <ul className="mt-2.5 space-y-2">
                  {PRESENCE.map((p) => (
                    <li key={p.name} className="flex items-center gap-2 text-xs text-zinc-200">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-white">{p.name}</span>
                      <span className="truncate text-zinc-400">{p.action}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end">
                  <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">
                    Open board
                  </span>
                </div>
              </div>

              {/* Board card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#15171a] md:p-5">
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    My First Board
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    ▶ Run
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {BOARD_ROWS.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-base shadow-sm dark:bg-white/10">
                        {row.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {row.label}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {row.detail}
                        </span>
                      </span>
                      {row.state === "done" ? (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                          ✓
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-blue-600/10 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:bg-blue-400/15 dark:text-blue-300">
                          Running…
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Fake output strip */}
                <div className="mt-3.5 rounded-xl bg-zinc-950 p-3.5 text-left">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    UI Design box output
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-zinc-300">
                    <div>
                      <span className="text-fuchsia-400">export default function</span>{" "}
                      <span className="text-cyan-300">App</span>() {"{"}
                    </div>
                    <div className="pl-4">
                      <span className="text-zinc-500">{"// a working React prototype"}</span>
                    </div>
                    <div className="pl-4">
                      <span className="text-emerald-300">return</span>{" "}
                      &lt;<span className="text-cyan-300">MealPlanner</span> /&gt;;
                    </div>
                    <div>{"}"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
