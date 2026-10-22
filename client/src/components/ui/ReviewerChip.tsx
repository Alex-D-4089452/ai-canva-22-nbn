/**
 * The reviewed-by pill from the landing page's "How it works" section, now a
 * real control for Handoff Brief boxes.
 *
 * Without `name` (and with `onReview`) it renders a clickable "Review" chip.
 * With `name` it becomes the static "Reviewed by <name> · <time>" record.
 * Uses the landing page's dark-pill styling in both places.
 */
interface ReviewerChipProps {
  /** Reviewer display name. Present = reviewed; absent = the Review action. */
  name?: string;
  /** Preformatted review time, e.g. "6:58 pm". */
  time?: string;
  /** Click handler for the Review action (ignored once reviewed). */
  onReview?: () => void;
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
  onReview,
  title,
  className = "",
}: ReviewerChipProps) {
  const reviewer = (name || "").trim();
  const reviewed = reviewer.length > 0;
  const label = reviewed
    ? `Reviewed by ${reviewer}${time ? ` · ${time}` : ""}`
    : "Review";

  if (!reviewed && onReview) {
    return (
      <button
        type="button"
        onClick={onReview}
        title={title || "Mark this handoff brief as reviewed"}
        aria-label="Mark this handoff brief as reviewed"
        className={
          BASE +
          " nodrag cursor-pointer transition hover:bg-zinc-800 focus:outline-none " +
          "focus-visible:ring-2 focus-visible:ring-emerald-400/70 dark:hover:bg-white/[0.14] " +
          className
        }
      >
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/15 text-slate-100">
          <EyeGlyph />
        </span>
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <span className={BASE + " " + className} title={title || (reviewed ? label : undefined)}>
      <span
        className={
          "grid h-4 w-4 shrink-0 place-items-center rounded-full " +
          (reviewed ? "bg-emerald-500 text-zinc-950" : "bg-white/15 text-slate-100")
        }
      >
        {reviewed ? <CheckGlyph /> : <EyeGlyph />}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
