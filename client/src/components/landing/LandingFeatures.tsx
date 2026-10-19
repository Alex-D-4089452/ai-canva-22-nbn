import { useState } from "react";
import Reveal from "./Reveal.js";
import InputRulesPanel from "../InputRulesPanel.js";
import { ShieldCheck } from "../ui/ShieldCheck.js";

/**
 * "AI drafts. A person decides." — the dark principles panel. Black in both
 * themes (a deliberate anchor card), lifting slightly in dark mode so it stays
 * a card rather than a hole in the page.
 */
const PRINCIPLES = [
  {
    title: "Always editable",
    body: "Every output is plain text or code on your board — tweak it by hand at any point, or feed it into the next box.",
  },
  {
    title: "Your data stays yours",
    body: "Boards live in your own Firebase project and models run on your Ollama server — nothing is sent to a third-party AI service.",
  },
  {
    title: "Runs when you need it",
    body: "Nothing runs automatically: you hit Run, and every call's token usage is tracked per box so you know what it costs.",
  },
  {
    title: "A person decides",
    body: "AI drafts, humans approve. A pipeline only produces what you connected and ran — no surprise side effects.",
  },
];

export default function LandingFeatures() {
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <section id="features" className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="rounded-[28px] bg-zinc-950 p-8 md:p-12 dark:border dark:border-white/10 dark:bg-[#15171a]">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              AI drafts. A person decides.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
              AI does the heavy lifting, you keep the pen. Every step stays
              editable, inspectable and yours.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {PRINCIPLES.map((p, i) => (
                <Reveal key={p.title} delay={(i % 2) * 100}>
                  <div className="flex h-full gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-zinc-950">
                      ✓
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{p.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                        {p.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Data-safety banner (mirrors the pipeline strip's note in the app). */}
            <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <div className="flex items-start gap-3.5 sm:items-center">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-zinc-950">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <p className="text-[13px] leading-relaxed text-slate-300 md:text-sm">
                  <span className="font-semibold text-white">
                    Only add synthetic or de-identified material.
                  </span>{" "}
                  Never upload customer, service, account or network details to any box.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="w-fit shrink-0 rounded text-[13px] font-semibold text-emerald-400 underline decoration-emerald-500/50 underline-offset-2 transition hover:text-emerald-300 hover:decoration-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 md:text-sm"
                aria-haspopup="dialog"
              >
                Read the input rules
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      <InputRulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </section>
  );
}
