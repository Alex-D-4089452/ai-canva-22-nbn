import type { ButtonHTMLAttributes } from "react";

/**
 * Shared button — the single source of truth for control styling in the app
 * chrome (header, sidebar, canvas tools).
 *
 * Enterprise-clean by design:
 *  - a single loud color per context: indigo `primary` for general actions and
 *    relay brand blue `brand` for the top-bar Run all action;
 *  - everything else is quiet neutrals (white / slate — or white-alpha on the
 *    dark app bar: `onDark` / `outlineLight` / `ghostLight`);
 *  - consistent heights, radii, and a visible keyboard focus ring.
 */
export type ButtonVariant =
  | "primary"
  | "brand"
  | "secondary"
  | "ghost"
  | "danger"
  | "onDark"
  | "outlineLight"
  | "ghostLight";
export type ButtonSize = "xs" | "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white border border-indigo-600 shadow-sm " +
    "hover:bg-indigo-500 hover:border-indigo-500",
  brand:
    "bg-[#1a73e8] text-white border border-[#1a73e8] shadow-sm " +
    "hover:bg-[#1667d6] hover:border-[#1667d6] " +
    "focus-visible:!ring-[#1a73e8]/50 focus-visible:ring-offset-[#0b0d12]",
  secondary:
    "bg-white text-slate-600 border border-slate-200 shadow-sm " +
    "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900",
  ghost:
    "bg-transparent text-slate-600 border border-transparent " +
    "hover:bg-slate-100 hover:text-slate-900",
  danger:
    "bg-white text-red-600 border border-red-200 " +
    "hover:bg-red-50 hover:border-red-300",
  // Dark-app-bar variants: neutrals become white-alpha; focus rings get a
  // dark offset so they don't flash a white square on the near-black bar.
  onDark:
    "bg-white/10 text-white border border-white/15 shadow-sm " +
    "hover:bg-white/15 hover:border-white/25 focus-visible:ring-offset-[#0b0d12]",
  outlineLight:
    "bg-transparent text-white border border-white/40 shadow-sm " +
    "hover:bg-white/10 focus-visible:ring-offset-[#0b0d12]",
  ghostLight:
    "bg-transparent text-slate-300 border border-transparent " +
    "hover:bg-white/10 hover:text-white focus-visible:ring-offset-[#0b0d12]",
};

/** Pressed / toggled state (e.g. an open panel or active view). */
const ACTIVE: Record<ButtonVariant, string> = {
  primary: "bg-indigo-700 border-indigo-700 text-white hover:bg-indigo-700",
  brand: "bg-[#1557b0] border-[#1557b0] text-white hover:bg-[#1557b0]",
  secondary:
    "bg-slate-900 border-slate-900 text-white " +
    "hover:bg-slate-800 hover:border-slate-800 hover:text-white",
  ghost: "bg-slate-900 border-slate-900 text-white hover:bg-slate-900",
  danger: "bg-red-600 border-red-600 text-white hover:bg-red-600",
  onDark: "bg-white/20 border-white/30 text-white hover:bg-white/20",
  outlineLight: "bg-white/15 border-white/60 text-white hover:bg-white/15",
  ghostLight: "bg-white/10 text-white hover:bg-white/10 hover:text-white",
};

const SIZE: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
};

const BASE =
  "inline-flex items-center justify-center font-medium whitespace-nowrap " +
  "transition-colors duration-150 select-none cursor-pointer " +
  "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-1 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders the pressed/toggled state (e.g. an open panel). */
  active?: boolean;
}

export function Button({
  variant = "secondary",
  size = "sm",
  active = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    BASE,
    SIZE[size],
    active ? ACTIVE[variant] : VARIANT[variant],
    className,
  ].join(" ");
  return <button type={type} className={classes} {...rest} />;
}