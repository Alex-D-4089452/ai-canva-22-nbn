interface LandingCTAProps {
  onSignIn: () => void;
  signingIn: boolean;
}

export default function LandingCTA({ onSignIn, signingIn }: LandingCTAProps) {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-300 via-green-400 to-emerald-500 p-8 md:p-12">
          {/* Soft highlight sweep */}
          <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight text-zinc-950 md:text-4xl">
                Start building your first AI pipeline
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-800/80 md:text-base">
                Sign in free and go from an idea to a working prototype in
                minutes. No setup, no code required to start.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <button
                onClick={onSignIn}
                disabled={signingIn}
                className="rounded-xl bg-zinc-950 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {signingIn ? "Connecting…" : "Start building free"}
              </button>
              <a
                href="#boxes"
                className="rounded-xl border border-zinc-950/25 px-6 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-950/10"
              >
                Browse the boxes
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
