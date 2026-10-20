import Reveal from "./Reveal.js";

interface LandingRolesProps {
  onSignIn: () => void;
  signingIn: boolean;
}

const PRODUCT_POINTS = [
  "Draft PRDs and pitch decks from research",
  "Align requirements before a line of code",
  "Share one board across the whole team",
];

export default function LandingRoles({ onSignIn, signingIn }: LandingRolesProps) {
  return (
    <section id="for-teams" className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          {/* Heading + the quieter third role */}
          <Reveal>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white md:text-4xl">
              Built for the
              <br />
              whole team
            </h2>
            <p className="mt-4 max-w-sm text-slate-500 dark:text-slate-400">
              One shared canvas, with a palette that adapts to how each role
              works.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-100 text-lg dark:bg-orange-500/15">
                  📊
                </span>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  For product &amp; PMs
                </h3>
              </div>
              <ul className="mt-3 space-y-1.5">
                {PRODUCT_POINTS.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400"
                  >
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Colored role cards + quote + CTA */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Reveal delay={80}>
              <div className="flex h-full flex-col rounded-2xl bg-emerald-500 p-6 text-zinc-950">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-950/10 text-lg">
                    🎨
                  </span>
                  <h3 className="text-sm font-bold">For designers</h3>
                </div>
                <ul className="mt-4 space-y-1.5 text-sm opacity-90">
                  <li>Generate polished UIs with Tailwind or Google Stitch</li>
                  <li>Turn research into visual screens and prototypes</li>
                  <li>A palette tuned to design boxes</li>
                </ul>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div className="flex h-full flex-col rounded-2xl bg-zinc-950 p-6 text-white dark:bg-[#15171a] dark:border dark:border-white/10">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-lg">
                    💻
                  </span>
                  <h3 className="text-sm font-bold">For developers</h3>
                </div>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
                  <li>Go from PRD to a working React prototype</li>
                  <li>Preview code live in a sandboxed iframe</li>
                  <li>Open any box in StackBlitz and keep building</li>
                </ul>
              </div>
            </Reveal>

            <Reveal delay={240}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
                <div>
                  <p className="text-xs tracking-widest text-amber-500">★★★★★</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    “relay is really useful for turning a messy workshop into
                    a plan the whole team can see and edit.”
                  </p>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Workshop facilitator · pilot programme
                </p>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <div className="flex h-full items-center">
                <button
                  onClick={onSignIn}
                  disabled={signingIn}
                  className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-slate-200"
                >
                  {signingIn ? "Connecting…" : "Explore roles →"}
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
