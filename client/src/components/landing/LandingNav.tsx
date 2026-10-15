interface LandingNavProps {
  onSignIn: () => void;
  signingIn: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
}

const LINKS = [
  { href: "#workshop", label: "Workshops" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#boxes", label: "Boxes" },
  { href: "#for-teams", label: "For teams" },
];

export default function LandingNav({
  onSignIn,
  signingIn,
  isDark,
  onToggleTheme,
}: LandingNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0c]/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="logo-tile items-center justify-center text-base">🎨</span>
          <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
            AI Canva
          </span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Light theme" : "Dark theme"}
            className="grid h-9 w-9 place-items-center rounded-lg text-base text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {isDark ? "☀️" : "🌙"}
          </button>
          <button
            onClick={onSignIn}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            Sign in
          </button>
          <button
            onClick={onSignIn}
            disabled={signingIn}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-60"
          >
            {signingIn ? "Connecting…" : "Get started"}
          </button>
        </div>
      </div>
    </header>
  );
}
