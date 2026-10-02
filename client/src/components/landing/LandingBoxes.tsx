import { BOX_TYPES } from "../../types.js";
import type { BoxType } from "../../types.js";
import Reveal from "./Reveal.js";

const ORDER: BoxType[] = [
  "idea",
  "research",
  "summarise",
  "prd",
  "ui",
  "stitch",
  "slides",
  "image",
  "cartoon",
];

export default function LandingBoxes() {
  return (
    <section id="boxes" className="border-t border-white/5 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            A box for every stage
          </h2>
          <p className="mt-3 text-slate-400">
            From a raw idea to a polished UI — each box is a focused AI step you
            can connect and reuse.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {ORDER.map((type, i) => {
            const meta = BOX_TYPES[type];
            return (
              <Reveal key={type} delay={(i % 4) * 80}>
                <div
                  className="flex h-full flex-col items-start gap-2 rounded-2xl border p-5 transition hover:-translate-y-0.5"
                  style={{
                    backgroundColor: meta.color + "12",
                    borderColor: meta.color + "40",
                  }}
                >
                  <span className="text-2xl">{meta.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-400">
                    {meta.description}
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
