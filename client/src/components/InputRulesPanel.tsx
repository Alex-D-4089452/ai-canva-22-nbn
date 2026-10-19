import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui/Button.js";
import { ShieldCheck } from "./ui/ShieldCheck.js";

/**
 * Input rules — a right-hand slide-over explaining what material may be
 * entered into boxes. Opened by the "Input rules" link in the pipeline strip's
 * data-safety note; rendered through a portal so it escapes the strip's
 * stacking context and covers the app chrome.
 */

const RULES: { title: string; body: string }[] = [
  {
    title: "Synthetic or de-identified only",
    body: "Use fictional, anonymised or de-identified examples in every box.",
  },
  {
    title: "No personal information",
    body: "Never enter real names, contact details, addresses, account or ID numbers, or health information.",
  },
  {
    title: "No confidential material",
    body: "Leave out internal pricing, contracts, unreleased plans, security details, or anything marked confidential.",
  },
  {
    title: "De-identify before you paste",
    body: 'Swap names for roles ("the customer"), identifiers for placeholders ("ACC-0000"), and exact dates for ranges.',
  },
  {
    title: "Uploads follow the same rules",
    body: "Crop or redact images and documents before adding them to a box.",
  },
];

interface InputRulesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function InputRulesPanel({ open, onClose }: InputRulesPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the dialog once it has slid in.
    const timer = setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="input-rules-title"
    >
      <div
        className="input-rules-backdrop absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="input-rules-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 id="input-rules-title" className="text-[15px] font-semibold text-slate-800">
                Input rules
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">What you can put in a box.</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            title="Close input rules"
            aria-label="Close input rules"
          >
            ✕
          </button>
        </div>

        {/* Rules */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3.5 py-3 text-[12px] leading-relaxed text-emerald-900">
            <span className="font-semibold">Synthetic or de-identified material only.</span> The
            boxes are for made-up or anonymised examples — not real customer, employee or
            confidential business information.
          </p>

          <ul className="mt-4 space-y-3">
            {RULES.map((rule) => (
              <li key={rule.title} className="flex gap-2.5">
                <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
                  ✓
                </span>
                <div>
                  <p className="text-[13px] font-medium text-slate-700">{rule.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{rule.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-600">Where it goes:</span> pressing Run sends
            a box's content to the AI model, and boards (with their box text, images and documents)
            are saved to the cloud so your team can collaborate.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
          <p className="text-[11px] text-slate-400">
            If in doubt, describe it instead of pasting it.
          </p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
