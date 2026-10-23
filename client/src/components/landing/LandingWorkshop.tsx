import Reveal from "./Reveal.js";

export interface WorkshopJoinState {
  code: string;
  onCodeChange: (code: string) => void;
  onJoin: () => void;
  joining: boolean;
  error: string;
}

interface LandingWorkshopProps {
  workshop: WorkshopJoinState;
  onSignIn: () => void;
}

/**
 * "Joining a workshop?" — the guest seat-code entry, inline on the landing page
 * (it used to be a floating pill + modal in App.tsx). Joining mints a Firebase
 * custom token via `POST /api/workshop/join`, so guests need no account; the
 * profile step runs after the auth state flips.
 */
export default function LandingWorkshop({ workshop, onSignIn }: LandingWorkshopProps) {
  const { code, onCodeChange, onJoin, joining, error } = workshop;
  const ready = code.length === 8;

  return (
    <section id="workshop" className="border-y border-slate-200 bg-slate-50 py-16 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Joining a workshop?
          </h2>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            Enter your facilitator's code to jump straight to the shared board.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mx-auto mt-10 grid max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-2 dark:border-white/10 dark:bg-[#14161a]">
            {/* Guest: join with a seat code */}
            <div className="p-6 md:border-r md:border-slate-200 md:dark:border-white/10">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Workshop code
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The 8-character code your facilitator shared with the group.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  aria-label="Workshop code"
                  className="lp-code-input w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-center text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-300 dark:border-white/15 dark:bg-[#0a0a0c] dark:text-white"
                  placeholder="CODE"
                  maxLength={8}
                  value={code}
                  onChange={(e) =>
                    onCodeChange(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))
                  }
                  onKeyDown={(e) => e.key === "Enter" && ready && onJoin()}
                />
                <button
                  onClick={onJoin}
                  disabled={!ready || joining}
                  className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {joining ? "Joining…" : "Join workshop"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>

            {/* Facilitator: start a workshop */}
            <div className="border-t border-slate-200 bg-slate-50 p-6 md:border-t-0 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Your facilitator code
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Running a workshop? Sign in to create teams, seat codes and
                templates from the Facilitator Dashboard — guests join with no
                account.
              </p>
              <button
                onClick={onSignIn}
                className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                Start a workshop →
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
