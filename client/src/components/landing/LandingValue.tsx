import Reveal from "./Reveal.js";

/**
 * The three highlight cards under the workshop section: green / blue / black.
 * Flat color fills in both themes (they carry the page's color, so they don't
 * change between light and dark — only the link chips adapt).
 */
const CARDS = [
  {
    tone: "green" as const,
    icon: "📍",
    title: "See the whole process at a glance",
    body: "Idea, research, PRD and prototype sit on one canvas — read the entire pipeline at a glance instead of hunting through twenty browser tabs.",
    link: { href: "#how-it-works", label: "See how it works" },
  },
  {
    tone: "blue" as const,
    icon: "👥",
    title: "Build it together",
    body: "Share one board with your team: live cursors, presence, notes, labels and checklists are built right into the canvas.",
    link: { href: "#for-teams", label: "Explore collaboration" },
  },
  {
    tone: "black" as const,
    icon: "⚡",
    title: "Try it before you build it",
    body: "Sketch a pipeline in minutes, run it, and keep what works. Every box is editable — nothing is locked in.",
    link: { href: "#boxes", label: "Browse the box gallery" },
  },
];

const TONE_CLASSES = {
  green: {
    card: "bg-emerald-500 text-zinc-950",
    icon: "bg-zinc-950 text-white",
    link: "text-zinc-950/80 group-hover:text-zinc-950",
    arrow: "border-zinc-950/25 group-hover:border-zinc-950/60",
  },
  blue: {
    card: "bg-blue-600 text-white",
    icon: "bg-white text-blue-700",
    link: "text-blue-100 group-hover:text-white",
    arrow: "border-white/40 group-hover:border-white",
  },
  black: {
    card: "bg-zinc-950 text-white dark:bg-[#15171a]",
    icon: "bg-emerald-500 text-zinc-950",
    link: "text-slate-300 group-hover:text-white",
    arrow: "border-white/25 group-hover:border-white/70",
  },
} as const;

export default function LandingValue() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-5 md:grid-cols-3">
          {CARDS.map((card, i) => {
            const tone = TONE_CLASSES[card.tone];
            return (
              <Reveal key={card.title} delay={i * 110}>
                <a
                  href={card.link.href}
                  className={
                    "group flex h-full flex-col rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-xl " +
                    tone.card
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-bold leading-snug">{card.title}</h3>
                    <span
                      className={
                        "grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg " +
                        tone.icon
                      }
                    >
                      {card.icon}
                    </span>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed opacity-90">{card.body}</p>
                  <span
                    className={
                      "mt-6 inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition " +
                      tone.arrow +
                      " " +
                      tone.link
                    }
                  >
                    {card.link.label} →
                  </span>
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
