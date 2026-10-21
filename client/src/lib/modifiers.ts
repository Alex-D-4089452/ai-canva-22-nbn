/** Modifier keys whose keydown/keyup state React Flow latches on `window`. */
export const MODIFIER_KEYS: ReadonlySet<string> = new Set(["Shift", "Control", "Meta", "Alt"]);

export interface ModifierKeyRelease {
  key: string;
  code: string;
}

interface ModifierFlags {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const MODIFIER_CHECKS: {
  key: string;
  code: string;
  isDown: (flags: ModifierFlags) => boolean;
}[] = [
  { key: "Shift", code: "ShiftLeft", isDown: (e) => e.shiftKey },
  { key: "Control", code: "ControlLeft", isDown: (e) => e.ctrlKey },
  { key: "Meta", code: "MetaLeft", isDown: (e) => e.metaKey },
  { key: "Alt", code: "AltLeft", isDown: (e) => e.altKey },
];

/**
 * Modifier keys we still think are held but a real pointer event says are up.
 *
 * React Flow tracks Shift / Ctrl / Cmd with window keydown/keyup listeners.
 * OS and browser shortcuts (Win+Shift+S, Cmd+Shift+5, …) can swallow the
 * matching keyup, leaving its selection mode latched: the next pane drag draws
 * a selection box instead of panning. Reconciling against the pointer event's
 * modifier flags lets us synthesize the missing keyup before the drag starts.
 */
export function staleModifierKeys(
  pressed: ReadonlySet<string>,
  flags: ModifierFlags
): ModifierKeyRelease[] {
  return MODIFIER_CHECKS.filter((m) => pressed.has(m.key) && !m.isDown(flags)).map(
    ({ key, code }) => ({ key, code })
  );
}
