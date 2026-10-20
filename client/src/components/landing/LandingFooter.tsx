import type { MouseEvent } from "react";

interface LandingFooterProps {
  onSignIn: () => void;
}

const COLUMNS: {
  title: string;
  external?: boolean;
  links: { label: string; href: string }[];
}[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Boxes", href: "#boxes" },
      { label: "For teams", href: "#for-teams" },
    ],
  },
  {
    title: "Workshops",
    links: [
      { label: "Join with a code", href: "#workshop" },
      { label: "Start a workshop", href: "#signin" },
      { label: "Create a team board", href: "#signin" },
    ],
  },
  {
    title: "Built with",
    external: true,
    links: [
      { label: "React", href: "https://react.dev" },
      { label: "Firebase", href: "https://firebase.google.com" },
      { label: "Ollama", href: "https://ollama.com" },
      { label: "React Flow", href: "https://reactflow.dev" },
    ],
  },
];

/** Blue in the light theme, near-black in the dark theme (per the design). */
export default function LandingFooter({ onSignIn }: LandingFooterProps) {
  const handleSignInLinks = (href: string) => (e: MouseEvent) => {
    if (href === "#signin") {
      e.preventDefault();
      onSignIn();
    }
  };

  return (
    <footer className="bg-blue-600 text-white dark:bg-[#0a0a0c]">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="logo-tile items-center justify-center text-base">🎨</span>
              <span className="text-base font-bold">relay</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-blue-100 dark:text-slate-400">
              We acknowledge the Traditional Owners and Custodians of Country
              throughout Australia and pay our respects to Elders past and
              present.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-200 dark:text-slate-500">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={handleSignInLinks(link.href)}
                      target={col.external ? "_blank" : undefined}
                      rel={col.external ? "noreferrer" : undefined}
                      className="text-sm text-blue-50 transition hover:text-white dark:text-slate-300 dark:hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-blue-500/50 pt-6 text-xs text-blue-100 md:flex-row md:items-center dark:border-white/10 dark:text-slate-500">
          <p>
            relay for nbn® is a capstone prototype. It isn't an official nbn
            product.
          </p>
          <p>Runs on your models · Your boards, your data</p>
        </div>
      </div>
    </footer>
  );
}
