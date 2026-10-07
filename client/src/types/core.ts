// Core board/box types shared by every box on the canvas.
//
// Each box type's metadata (label, icon, prompts, sizes) lives in its own
// file under `./boxes/`; `./boxTypes.ts` assembles them into BOX_TYPES and
// `./index.ts` re-exports the whole public surface.

export type BoxType = "agent" | "idea" | "research" | "summarise" | "image" | "documents" | "cartoon" | "slides" | "prd" | "ui" | "stitch" | "handoff" | "alignment" | "jargon" | "note" | "label" | "timer" | "checklist" | "custom";

/**
 * One task in a Checklist box — the team's shared to-do list. Every field is
 * always defined (no `undefined`) because these objects live inside a BoxData
 * array and Firestore rejects `undefined` anywhere in a nested value.
 *
 * Attribution is deliberately stored per item: a checklist is edited by the
 * whole team (last-write-wins between simultaneous users, like notes), so
 * "who added it" and "who ticked it off" are part of the record.
 */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  /** Email of the teammate who owns the task ("" = unassigned). */
  assignee: string;
  /** Who added the task (email) and when (epoch ms). */
  createdBy: string;
  createdAt: number;
  /** Who ticked it off and when ("" / 0 while the task is still open). */
  doneBy: string;
  doneAt: number;
}

export type BoxStatus = "idle" | "running" | "done" | "error";

/** A single slide in a generated deck. */
export interface Slide {
  title: string;
  bullets: string[];
  notes?: string;
}

/**
 * A document attached to a Documents box. All fields are always defined (no
 * `undefined`) so the object survives Firestore writes, which reject
 * `undefined` anywhere in a nested value.
 */
export interface BoxDocument {
  id: string;
  /** Original filename (kept for labeling in prompts and the file list). */
  name: string;
  /** Raw file size in bytes. */
  size: number;
  /** Lowercase extension without the dot ("pdf", "txt", …). */
  ext: string;
  /** Storage download URL — "" when the file was not uploaded (local mode). */
  url: string;
  /** Extracted text — "" when extraction failed (see error). */
  text: string;
  /** Characters of extracted text actually kept (after any truncation). */
  chars: number;
  /** True when the extracted text was capped (see lib/documents.ts limits). */
  truncated: boolean;
  /** "" when extraction succeeded, otherwise a short failure reason. */
  error: string;
}

/** A user currently active on a board with their cursor position. */
export interface PresenceUser {
  userId: string;
  email: string;
  displayName: string;
  initials: string;
  color: string;
  cursorX: number;
  cursorY: number;
  /** False when the user is online (heartbeat) but has never moved their
   *  cursor — Cursors skips those so no stray cursor renders at (0, 0). */
  hasCursor?: boolean;
}

/** A connected upstream input with its box name and output. */
export interface NamedInput {
  name: string;
  output: string;
}

/**
 * One recorded step of an Agent box run (a plan note, a board action, or a
 * completion/error marker). Persisted in the box's `agentSteps` so the
 * transcript survives reloads and is visible to every board collaborator.
 */
export interface AgentStep {
  id: string;
  /** Kind of step — drives the icon and color in the box's timeline. */
  type: "plan" | "add_box" | "connect" | "run" | "finish" | "stopped" | "error";
  /** Human-readable one-liner shown in the log. */
  label: string;
  /** Optional extra detail (model reasoning, parse error preview). */
  detail?: string;
  /** Board box id affected by this step (add_box / run). */
  boxId?: string;
  /** Epoch ms when the step happened. */
  at: number;
}

/**
 * One immutable version of an append-only artifact history. Regeneration (or an
 * AI-applied change, or a revert) appends a new version — an existing version is
 * never rewritten or removed. A UI Design box's code shares this shape.
 */
export interface ArtifactVersion {
  version: number;
  /** The artifact itself (code for a UI Design box). */
  content: string;
  /** Epoch ms when the version was created. */
  createdAt: number;
  /** Display name of whoever produced it. */
  createdBy: string;
  /** Whether the model generated it or a human changed it. */
  source: "generated" | "edited";
  /** What prompted this version (the change request, "" otherwise). */
  note: string;
}

/**
 * Where a box's code was last published (the 🚀 Deploy button, which ships the
 * box's code to here.now — see `client/src/lib/deploy.ts`). Every field is always
 * defined: Firestore rejects `undefined` inside a nested value.
 */
export interface DeployInfo {
  /** here.now Site slug — sent back to update the same Site. */
  slug: string;
  /** The live URL, e.g. `https://cobalt-castle-y2d3.here.now/`. */
  url: string;
  /** The live version at deploy time — sent back as `baseVersionId`. */
  versionId: string;
  /**
   * Anonymous Sites only, and returned by here.now EXACTLY ONCE: without it the
   * Site can never be updated again. Kept on the box so redeploys work.
   */
  claimToken: string;
  /** Anonymous-only claim link ("" for a permanent Site). */
  claimUrl: string;
  /** True when the Site is anonymous (expires) rather than permanent. */
  anonymous: boolean;
  /** ISO expiry for an anonymous Site ("" when permanent). */
  expiresAt: string;
  /** Epoch ms of the last successful deploy (0 = never). */
  deployedAt: number;
  /** Files published in the last deploy. */
  fileCount: number;
  /** Bytes published in the last deploy. */
  bytes: number;
  /** Non-fatal notes from here.now (e.g. a manifest warning). */
  warnings: string[];
  /** Why the last deploy attempt failed ("" on success). */
  error: string;
}

/** Data stored per-box, separate from React Flow's graph nodes. */
export interface BoxData {
  content: string;
  prompt: string;
  systemPrompt: string;
  output: string;
  status: BoxStatus;
  error?: string;
  imageData?: string;
  outputImage?: string;
  /** For Documents boxes: the uploaded files + their extracted text. */
  documents?: BoxDocument[];
  slides?: Slide[];
  /** For UI Design / Stitch boxes: the generated React component code (JSX). */
  code?: string;
  /** UI Design boxes: the change request to apply to the current code (AI edit). */
  changePrompt?: string;
  /** UI Design boxes: append-only history of every code version (never rewritten). */
  codeVersions?: ArtifactVersion[];
  /** UI Design boxes: the version the current `code` corresponds to (0 = none). */
  codeVersion?: number;
  /** Token usage from the most recent LLM call for this box (text AI boxes). */
  tokens?: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** For Agent boxes: the step log of the most recent (or current) run. */
  agentSteps?: AgentStep[];
  /** For Note boxes: who created the note (set once at creation). */
  authorEmail?: string;
  authorName?: string;
  /** For Label boxes: the pill's background color (one of LABEL_COLORS). */
  labelColor?: string;
  /** For Timer boxes — see client/src/lib/timer.ts for the state machine. */
  timerDurationMs?: number;
  timerStatus?: "idle" | "running" | "stopped" | "paused";
  /** Epoch ms when the current run started (basis for every viewer's countdown). */
  timerStartedAt?: number;
  /** Frozen remaining time in ms (set on pause/stop so all viewers agree). */
  timerRemainingMs?: number;
  /** Email of the user who last started the timer (shown as attribution). */
  timerStartedBy?: string;
  /**
   * For Checklist boxes: the shared team to-do items (see
   * `client/src/lib/checklist.ts` for every mutation and the paste parser).
   */
  checklistItems?: ChecklistItem[];
  /** UI Design / Stitch boxes: where the code was last published. */
  deploy?: DeployInfo;
  /** Handoff Brief boxes: the source and destination roles. */
  handoffFrom?: string;
  handoffTo?: string;
  /**
   * Epoch ms when the box last finished a run (success or error) — drives the
   * "Not run yet" / "Ran at <date, time>" status strip in BoxNode. Stamped by
   * runBox / runAgentLoop's `finally`; omitted until the first run completes.
   */
  ranAt?: number;
  /** Legacy Handoff Brief run timestamp — read as a fallback by the status
   *  strip for boards saved before `ranAt` existed; new runs only stamp ranAt. */
  handoffGeneratedAt?: number;
  /** Legacy Alignment Check run timestamp — same fallback rule as above. */
  alignmentRanAt?: number;
  /** Jargon Translator boxes: number of jargon terms explained in the output. */
  jargonTerms?: number;
}

/** Metadata for each box type. */
export type BoxCategory = "input" | "worker" | "collab" | "custom";

/**
 * A role/persona a box is aimed at. Boxes tagged `"everyone"` appear in every
 * role view (they are shared pipeline scaffolding). See `docs/BOX_TYPES.md`.
 */
export type BoxRole = "everyone" | "designer" | "developer" | "product";

export interface BoxTypeMeta {
  label: string;
  icon: string;
  color: string;
  description: string;
  hasAI: boolean;
  category: BoxCategory;
  /** Role tags used to filter the palette per persona (labels, not permissions). */
  roles: BoxRole[];
  defaultPrompt: string;
  defaultSystemPrompt: string;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * Preset area colors for drawn rectangular areas: intentionally VERY light
 * fills (Tailwind -100 shades) with slightly stronger -200/-300 borders, so
 * areas read as background grouping regions and never compete with boxes,
 * notes, or edges on top of them.
 */
export const AREA_COLORS: { fill: string; border: string; name: string }[] = [
  { fill: "#fef3c7", border: "#fde68a", name: "Amber" },
  { fill: "#dbeafe", border: "#bfdbfe", name: "Blue" },
  { fill: "#d1fae5", border: "#a7f3d0", name: "Emerald" },
  { fill: "#fce7f3", border: "#fbcfe8", name: "Pink" },
  { fill: "#ede9fe", border: "#ddd6fe", name: "Violet" },
  { fill: "#cffafe", border: "#a5f3fc", name: "Cyan" },
  { fill: "#ffedd5", border: "#fed7aa", name: "Orange" },
  { fill: "#f1f5f9", border: "#e2e8f0", name: "Slate" },
];
