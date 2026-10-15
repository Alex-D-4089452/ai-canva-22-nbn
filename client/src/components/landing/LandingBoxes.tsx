import { useState } from "react";
import { BOX_TYPES } from "../../types/index.js";
import type { BoxCategory } from "../../types/index.js";
import Reveal from "./Reveal.js";

interface LandingBoxesProps {
  onSignIn: () => void;
  signingIn: boolean;
}

type Filter = "all" | BoxCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "input", label: "Input" },
  { value: "worker", label: "Workers" },
  { value: "collab", label: "Collaborate" },
];

// `custom` is a runtime type (the user's own saved templates), not a built-in
// box, so it never appears in the gallery. Insertion order = palette order.
const GALLERY = Object.entries(BOX_TYPES)
  .filter(([type]) => type !== "custom")
  .map(([type, meta]) => ({ type, meta }));

export default function LandingBoxes({ onSignIn, signingIn }: LandingBoxesProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? GALLERY : GALLERY.filter((b) => b.meta.category === filter);

  return (
    <section id="boxes" className="border-y border-slate-200 bg-slate-50 py-16 md:py-20 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal className="max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
              A box for every stage
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              From a raw idea to a polished UI — each box is a focused AI step
              you can connect and reuse.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition " +
                    (filter === f.value
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((b, i) => (
            <Reveal key={b.type} delay={(i % 4) * 70}>
              <div className="flex h-full flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-xl"
                  style={{ backgroundColor: b.meta.color + "1F" }}
                >
                  {b.meta.icon}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {b.meta.label}
                </span>
                <span className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {b.meta.description}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Reveal>
            <button
              onClick={onSignIn}
              disabled={signingIn}
              className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-60"
            >
              {signingIn ? "Connecting…" : "Build your first box →"}
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
