import Reveal from "./Reveal.js";

const FEATURES = [
  {
    icon: "🧩",
    title: "12 AI box types",
    body: "Idea, Research, PRD, UI Design, Stitch, Agent and more — each a focused, reusable AI step.",
  },
  {
    icon: "🔗",
    title: "Visual pipelines",
    body: "Chain boxes on a canvas and watch content flow from research to a working prototype.",
  },
  {
    icon: "👥",
    title: "Real-time collaboration",
    body: "Share a board, see live cursors and presence, and build together on the same canvas.",
  },
  {
    icon: "💻",
    title: "Live code preview",
    body: "Code and UI boxes render a working React prototype in a sandboxed iframe — no setup.",
  },
  {
    icon: "⚡",
    title: "Token tracking",
    body: "See per-box and cumulative LLM token usage so you know exactly what each run costs.",
  },
  {
    icon: "🎨",
    title: "Role-based palettes",
    body: "Designer, Developer and Product views surface the boxes each role needs, without hiding the pipeline.",
  },
];

export default function LandingFeatures() {
  return (
    <section id="features" className="border-t border-white/5 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Everything you need to ship with AI
          </h2>
          <p className="mt-3 text-slate-400">
            A whiteboard that turns ideas into working software, step by step.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 100}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/[0.07]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-2xl">
                  {f.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
