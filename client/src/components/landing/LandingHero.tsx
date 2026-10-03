interface LandingHeroProps {
  onSignIn: () => void;
  signingIn: boolean;
}

const PIPELINE = [
  { icon: "💡", label: "Idea", color: "#fbbf24" },
  { icon: "🔍", label: "Research", color: "#60a5fa" },
  { icon: "📄", label: "PRD", color: "#818cf8" },
  { icon: "💻", label: "UI Design", color: "#22d3ee" },
];

export default function LandingHero({ onSignIn, signingIn }: LandingHeroProps) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 pt-16 pb-20 text-center md:pt-24">
        {/* Badge */}
        <div className="fade-in inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Visual AI pipelines · real-time collaboration
        </div>

        {/* Headline */}
        <h1 className="fade-in fade-in-delay-1 mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
          Build AI pipelines{" "}
          <span className="gradient-text">visually</span>, from idea to code
        </h1>

        {/* Subheadline */}
        <p className="fade-in fade-in-delay-2 mx-auto mt-5 max-w-2xl text-lg text-slate-300 md:text-xl">
          Place boxes on a canvas, connect them, and let AI content flow from
          research to PRD to a working prototype — together with your team.
        </p>

        {/* CTAs */}
        <div className="fade-in fade-in-delay-3 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={onSignIn}
            disabled={signingIn}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-indigo-500/30 transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            {signingIn ? "Connecting…" : "Get started free"}
          </button>
          <a
            href="#how-it-works"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
          >
            See how it works
          </a>
        </div>

        {/* Product mockup */}
        <div className="fade-in fade-in-delay-4 relative mx-auto mt-14 max-w-3xl">
          <div className="glass-card p-5 md:p-7">
            {/* Fake window chrome */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <span className="text-xs text-slate-400">My First Board</span>
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-slate-300">
                ▶ Run
              </span>
            </div>

            {/* Pipeline boxes */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
              {PIPELINE.map((box, i) => (
                <div key={box.label} className="flex items-center gap-2 md:gap-3">
                  <div
                    className="flex flex-col items-center gap-1.5 rounded-xl px-4 py-3"
                    style={{
                      backgroundColor: box.color + "1f",
                      border: "1px solid " + box.color + "55",
                      boxShadow: "0 8px 24px -12px " + box.color + "66",
                    }}
                  >
                    <span className="text-2xl">{box.icon}</span>
                    <span className="text-xs font-semibold" style={{ color: box.color }}>
                      {box.label}
                    </span>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <span className="pipeline-arrow text-slate-400">→</span>
                  )}
                </div>
              ))}
            </div>

            {/* Fake output */}
            <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-4 text-left">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                UI Design box output
              </div>
              <div className="space-y-1.5 font-mono text-xs text-slate-300">
                <div>
                  <span className="text-fuchsia-400">function</span>{" "}
                  <span className="text-cyan-300">App</span>() {"{"}
                </div>
                <div className="pl-4">
                  <span className="text-slate-500">{"// a working React prototype"}</span>
                </div>
                <div className="pl-4">
                  <span className="text-emerald-300">return</span> (
                  <span className="text-slate-400">&lt;MealPlanner /&gt;</span>);
                </div>
                <div>{"}"}</div>
              </div>
            </div>
          </div>

          {/* Glow behind mockup */}
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/15 to-cyan-500/20 blur-3xl" />
        </div>
      </div>
    </section>
  );
}
