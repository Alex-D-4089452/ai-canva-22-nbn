interface RelayWordmarkProps {
  className?: string;
  /** All-white lockup for the blue footer (and its dark equivalent). */
  monochrome?: boolean;
}

/**
 * Lowercase relay wordmark: the "l" carries the brand blue and the rest
 * follows the surrounding theme. The footer uses the monochrome variant
 * because it sits on the brand-blue panel.
 */
export function RelayWordmark({ className = "", monochrome = false }: RelayWordmarkProps) {
  const neutral = monochrome ? "text-white" : "text-slate-900 dark:text-white";
  const accent = monochrome ? "text-white" : "text-[#1a73e8]";

  return (
    <span className={`inline-block select-none font-bold tracking-tight ${className}`}>
      <span className={neutral}>re</span>
      <span className={accent}>l</span>
      <span className={neutral}>ay</span>
    </span>
  );
}
