import type { BoxData } from "../types/index.js";

/**
 * Pure logic for Timer boxes. The timer is a small collaborative state
 * machine stored in the box's BoxData and synced to every viewer through the
 * board document:
 *
 *  - idle    → nothing running; display shows timerDurationMs.
 *  - running → countdown derived from timerStartedAt (epoch ms, set by
 *              whoever pressed Start) — every viewer computes
 *              `remaining = timerRemainingMs − (now − timerStartedAt)`
 *              locally, so ticking costs zero Firestore writes.
 *  - paused  → frozen at timerRemainingMs (written at the moment of pausing).
 *  - stopped → frozen at timerRemainingMs (the Stop button).
 *
 * Only state *transitions* (start / pause / resume / stop / reset) write to
 * the store; the per-tick display is always recomputed locally. Keep it that
 * way — writing per second would spam saves and snapshot syncs.
 */

/** Smallest allowed timer (1 second). */
export const MIN_TIMER_MS = 1_000;
/** Largest allowed timer (8 hours). */
export const MAX_TIMER_MS = 8 * 60 * 60 * 1_000;
/** Default duration when a Timer box is created (5 minutes). */
export const DEFAULT_TIMER_MS = 5 * 60 * 1_000;

/**
 * Parses a user-entered duration into milliseconds. Accepts:
 *   "90"        → 90 seconds
 *   "5:30"      → 5 minutes 30 seconds
 *   "1:00:00"   → 1 hour
 * Returns null for anything unparseable, and clamps to
 * [MIN_TIMER_MS, MAX_TIMER_MS] when out of range.
 */
export function parseDurationInput(text: string): number | null {
  const raw = text.trim();
  if (!raw) return null;
  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length > 3 || parts.some((p) => p === "" || !/^\d+$/.test(p))) {
    return null;
  }
  const nums = parts.map((p) => parseInt(p, 10));
  // Range checks are positional: "90" is 90 seconds (fine), but "5:90" is an
  // invalid MM:SS and "1:90:00" an invalid H:MM:SS.
  let ms: number;
  if (nums.length === 3) {
    if (nums[1] >= 60 || nums[2] >= 60) return null;
    ms = ((nums[0] * 60 + nums[1]) * 60 + nums[2]) * 1_000;
  } else if (nums.length === 2) {
    if (nums[1] >= 60) return null;
    ms = (nums[0] * 60 + nums[1]) * 1_000;
  } else {
    ms = nums[0] * 1_000;
  }
  if (ms < MIN_TIMER_MS) return MIN_TIMER_MS;
  if (ms > MAX_TIMER_MS) return MAX_TIMER_MS;
  return ms;
}

/**
 * Formats milliseconds as a digital-clock string: "MM:SS" under an hour,
 * "H:MM:SS" at an hour or more. Zero and negatives both render as "00:00".
 */
export function formatTimer(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1_000));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Fields of BoxData the timer state machine reads. */
export type TimerFields = Pick<
  BoxData,
  "timerStatus" | "timerStartedAt" | "timerRemainingMs" | "timerDurationMs"
>;

/**
 * Computes the remaining milliseconds for a timer box at a given time
 * (`now` = epoch ms). Never negative; treats old boards missing the timer
 * fields as idle with the default duration.
 */
export function computeRemainingMs(box: TimerFields, now: number): number {
  const duration =
    typeof box.timerDurationMs === "number" ? box.timerDurationMs : DEFAULT_TIMER_MS;

  if (box.timerStatus === "running" && typeof box.timerStartedAt === "number") {
    const basis =
      typeof box.timerRemainingMs === "number" ? box.timerRemainingMs : duration;
    return Math.max(0, basis - (now - box.timerStartedAt));
  }
  if (
    (box.timerStatus === "paused" || box.timerStatus === "stopped") &&
    typeof box.timerRemainingMs === "number"
  ) {
    return Math.max(0, box.timerRemainingMs);
  }
  return duration;
}

/** True when the countdown has reached zero while running (visual alarm). */
export function isTimerFinished(box: TimerFields, now: number): boolean {
  return box.timerStatus === "running" && computeRemainingMs(box, now) <= 0;
}