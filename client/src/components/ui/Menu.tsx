import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Minimal dropdown menu: a trigger render-prop plus an absolutely positioned
 * panel. Closes on outside click and on Escape — the same contract as the
 * presence roster popover. No portal: these menus live in the header, which
 * already sits high in the stacking order.
 */
interface MenuProps {
  /** Render-prop receiving the trigger's toggle + open state. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  /**
   * Panel content. Pass a function `(close) => …` to let items close the
   * menu after acting (the usual behavior); a plain node keeps it open.
   */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Extra classes for the panel (e.g. a width: "w-72"). */
  panelClassName?: string;
}

export function Menu({ trigger, children, panelClassName = "w-64" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={wrapRef} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={
            "absolute right-0 top-full mt-2 z-50 rounded-xl bg-white " +
            "border border-slate-200/80 shadow-xl shadow-slate-900/10 overflow-hidden " +
            panelClassName
          }
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

/** A clickable row inside a Menu panel. */
interface MenuItemProps {
  icon?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  /** Brand-blue row for the primary action (e.g. "New Board"). */
  accent?: boolean;
  /** Marks the currently-selected entry (e.g. the open board). */
  active?: boolean;
}

export function MenuItem({ icon, label, description, onClick, danger, accent, active }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors " +
        (danger
          ? "text-red-600 hover:bg-red-50"
          : accent
            ? "text-[#1a73e8] hover:bg-[#1a73e8]/5"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900") +
        (active ? " bg-indigo-50/70" : "")
      }
    >
      {icon !== undefined && (
        <span className={"w-4 text-center flex-shrink-0 text-sm " + (danger || accent ? "" : "text-slate-500")}>
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium truncate">{label}</span>
        {description && (
          <span className="block text-[11px] text-slate-400 truncate">{description}</span>
        )}
      </span>
      {active && <span className="text-indigo-500 text-xs flex-shrink-0">✓</span>}
    </button>
  );
}

/** Thin separator inside a Menu panel. */
export function MenuDivider() {
  return <div className="h-px bg-slate-100 my-1" />;
}

/** Muted uppercase caption inside a Menu panel. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </div>
  );
}