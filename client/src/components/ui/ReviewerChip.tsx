/**
 * The reviewed-by pill from the landing page's "How it works" section, now a
 * real control for Handoff Brief boxes.
 *
 * Without `name` it renders the clickable "Review" action. With `name` it
 * shows "Reviewed by <name> · <time>"; when `onToggle` is present that record
 * is clickable too, so a second click removes the review. Without `onToggle`
 * (the landing page usage) it is a static pill.
 */
interface ReviewerChipProps {
  /** Reviewer display name. Present = reviewed; absent = the Review action. */
  name?: string;
  /** Preformatted review time, e.g. "6:58 pm". */
  time?: string;
  /** Toggle handler; when present the chip is a button. */
  onToggle?: () => void;
  title?: string;
  className?: string;
}

const BASE =
  "inline-flex items-center gap-2 rounded-full bg-zinc-950 px-3.5 py-1.5 " +
  "text-[11px] font-medium text-slate-200 ring-1 ring-white/10 pointer-events-auto " +
  "dark:bg-white/[0.08] dark:ring-white/15";

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-2.5 w-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      aria-hidden="true"
    >
      <path d="m4.5 12.5 5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-2.5 w-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export default function ReviewerChip({
  name,
  time,
  onToggle,
  title,
  className = "",
}: ReviewerChipProps) {
  const reviewer = (name || "").trim();
  const reviewed = reviewer.length > 0;
  const label = reviewed
    ? `Reviewed by ${reviewer}${time ? ` · ${time}` : ""}`
    : "Review";

  const icon = reviewed ? <CheckGlyph /> : <EyeGlyph />;
  const iconClass =
    "grid h-4 w-4 shrink-0 place-items-center rounded-full " +
    (reviewed ? "bg-emerald-500 text-zinc-950" : "bg-white/15 text-slate-100");

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={title || (reviewed ? "Remove this review" : "Mark this handoff brief as reviewed")}
        aria-label={reviewed ? `Remove review by ${reviewer}` : "Mark this handoff brief as reviewed"}
        className={
          BASE +
          " nodrag cursor-pointer transition hover:bg-zinc-800 focus:outline-hidden " +
          "focus-visible:ring-2 focus-visible:ring-emerald-400/70 dark:hover:bg-white/[0.14] " +
          className
        }
      >
        <span className={iconClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <span className={BASE + " " + className} title={title || (reviewed ? label : undefined)}>
      <span className={iconClass}>{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
