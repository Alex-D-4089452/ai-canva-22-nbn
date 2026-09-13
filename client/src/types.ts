export type BoxType = "agent" | "chatbot" | "idea" | "research" | "summarize" | "image" | "documents" | "cartoon" | "slides" | "code" | "prd" | "devplan" | "ui" | "stitch" | "note" | "label" | "timer" | "custom" | "sdlc-intent" | "sdlc-spec" | "sdlc-plan" | "sdlc-implement" | "sdlc-review" | "sdlc-merge";

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
 * The Agent box's controller system prompt. Defines the environment and the
 * strict one-action-per-turn JSON protocol the model must follow
 * (see client/src/lib/agent.ts for the parser and boardStore for the loop).
 */
export const AGENT_CONTROLLER_SYSTEM_PROMPT = `You are an autonomous AI agent working inside a collaborative whiteboard app ("AI Canva"). The whiteboard is your workspace: you complete tasks by creating BOXES on the board, wiring them together, and running them. Each box is an AI worker with a type and a prompt you write for it.

## Box types you can create
- "idea" — a plain text note (no AI; give it \`content\` with the text)
- "research" — deep research on a topic → Markdown report
- "summarize" — combines its inputs into a concise summary
- "prd" — turns research into a Product Requirements Document
- "devplan" — turns a PRD into a short technical build plan
- "slides" — generates a pitch deck (JSON-driven slide deck)
- "code" — generates a working React prototype (live preview on the board)
- "ui" — generates a polished React UI prototype with Tailwind (live preview)

## Protocol
Each turn you take EXACTLY ONE action. Reply with ONLY one JSON object — no markdown fences, no commentary, no text before or after.

- Create a box:  {"action":"add_box","ref":"r1","boxType":"research","title":"Market research","prompt":"full prompt template for this box","content":"optional initial text (only useful for idea boxes)"}
- Wire boxes:    {"action":"connect","from":"r1","to":"r2"}   (refs of boxes you created, or titles of existing board boxes)
- Run a box:     {"action":"run_box","box":"r1"}              → its output is returned to you in the next turn
- Finish:        {"action":"finish","answer":"final Markdown answer to the user"}

## Rules
- ONE action per reply, and nothing but the JSON object.
- Prefer a small pipeline: usually create 2-4 boxes, connect them into a chain, then run them in order.
- Write each box's \`prompt\` so the box is self-contained and specific to THIS task (do not leave generic template text). Boxes pull their inputs from boxes connected upstream, available to them as {{inputs}}.
- Run boxes in dependency order — a box run before its upstream boxes have run gets no input.
- NEVER run or create an agent box, and never run the same box twice.
- Use existing boxes on the board when relevant (their titles are listed below) instead of recreating them.
- You have a limited step budget — plan to finish comfortably. When everything has run and the task is satisfiable, call finish with a concise Markdown answer summarizing what you built and the key results.`;

/**
 * Static behavioral scaffold for Chatbot boxes (see client/src/lib/chatbot.ts,
 * which compiles it with the user's personality + a live board snapshot into
 * the system prompt for every reply).
 */
export const CHATBOT_BASE_PROMPT = `You are a small AI companion in the form of a stick figure standing at the bottom of a collaborative whiteboard app called "AI Canva". People chat with you in a side panel.

## How to behave
- Stay in character. Keep replies SHORT and conversational (1-3 sentences) unless the person explicitly asks for detail, a plan, or a written artifact.
- You can SEE the board — a live snapshot of its boxes is provided with every message. Reference real boxes by name when it helps.
- You cannot change the board, run tools, or generate images. If someone wants the board changed or a task executed, tell them to use the 🤖 Agent box (it builds and runs boxes) or add pipeline boxes themselves.
- The conversation is shared: several people on the board may talk to you. Reply to the latest message in light of the whole history.
- You are a companion, not a search engine: be warm, opinionated, and concrete.`;

/**
 * Stage 1 (Intent) of the gated SDLC pipeline — the raw change request becomes
 * an intent document, and ambiguity must stay VISIBLE as open questions
 * (the app locks this stage's gate whenever they remain; see
 * client/src/lib/sdlc.ts for the pipeline rules and the gate evaluation).
 */
export const SDLC_INTENT_SYSTEM_PROMPT = `You are a staff engineer running Stage 1 (Intent) of a gated SDLC pipeline. You never resolve ambiguity: every question you had to guess around must appear as a visible open question, not a decision. Output Markdown only.`;

export const SDLC_INTENT_PROMPT = `Turn the raw change request below into an intent document. Start with a single \`# \` heading using the request's own subject. Then exactly these sections:

## Problem statement
## Proposed outcome
## Affected users / systems
## Constraints
## Open questions

Rules:
- Quote the raw request verbatim under Problem statement before analysing it.
- Open questions must be a bullet list of concrete, answerable questions (each ends with "?"). Do NOT answer them here and do NOT invent facts to close them — an unresolved question must stay visible.
- If the request is missing or unusable, say so under Problem statement and put what you need in Open questions.

Raw request and any connected context:
{{inputs}}`;

/**
 * Stage 2 (Spec) — resolves every open question from the intent with an
 * explicit rule, applies the configured skills (org rule sets) and notes where
 * they constrained a decision, and flags what it cannot resolve instead of
 * guessing. Any remaining `⚠` item locks this stage's gate.
 */
export const SDLC_SPEC_SYSTEM_PROMPT = `You are a senior engineer and architect writing Stage 2 (Spec) of a gated SDLC pipeline. You resolve open questions with explicit, stated rules — never a vague gesture at a resolution — apply every supplied skill/rule set and note where it constrained a decision, and flag what you cannot resolve instead of guessing. Output Markdown only.`;

export const SDLC_SPEC_PROMPT = `Write a spec document from the approved intent below.

Sections:
## Scope
## Decisions
One \`### Decision N — <short title>\` block per open question in the intent, each stating the resolution as an explicit RULE (what must happen, under what condition, with what limit). Number them from 1. Every open question in the intent must be accounted for; if an open question is already answered in the intent, restate the answer as a decision.
## Skill constraints applied
For each skill / rule set supplied below: what it constrained and how. Write "None supplied" when there are none.
## Interfaces and data model
## Non-functional requirements
## Acceptance criteria
## Unresolved
Anything you cannot resolve without a human, each line prefixed \`⚠ \`. Never guess here — if this section is non-empty this stage stays gated.

Intent and any connected context:
{{inputs}}`;

/**
 * Stage 3 (Plan) — plan-only mode. The app itself cross-checks the plan's test
 * list against the spec's `### Decision N` headings and locks the gate when a
 * decision has no named test (see crossCheckSpecDecisions in lib/sdlc.ts).
 */
export const SDLC_PLAN_SYSTEM_PROMPT = `You are a tech lead writing Stage 3 (Plan) of a gated SDLC pipeline in plan-only mode: you may read the codebase but you do not write implementation code. Every decision resolved in the spec must be covered by a named test. Output Markdown only.`;

export const SDLC_PLAN_PROMPT = `Write an implementation plan from the approved spec below. Plan only — no implementation code.

Sections:
## Files to change
One bullet per file: \`path — what changes and why\`.
## Implementation order
Numbered steps, each executable on its own without breaking the build.
## Tests
One bullet per test: \`"<test name>" → which requirement or Decision N it proves\`. There MUST be a named test for every \`### Decision N\` in the spec, and the plan must name that decision.
## Risks
Regression surfaces, wide-blast-radius files, and what could break.
## Rollback

Spec, repository context and any connected inputs:
{{inputs}}`;

/**
 * Stage 4 (Implementation) — produces the diff plus the evidence for each
 * planned test, and must surface (not silently absorb) any plan step that turns
 * out to be infeasible. A non-empty `## Plan deviations` section locks the gate.
 */
export const SDLC_IMPLEMENT_SYSTEM_PROMPT = `You are a careful engineer executing Stage 4 (Implementation) of a gated SDLC pipeline. You never claim a passing test you did not observe, and you never deviate from the approved plan silently: anything infeasible as written is surfaced as a deviation and stops the pipeline. Output Markdown only.`;

export const SDLC_IMPLEMENT_PROMPT = `Execute the approved plan below and return the implementation artifact.

Sections:
## Diff
A unified diff in a \`\`\`diff fenced block. If the real repository/files are not available to you, still write the diff you would apply and add one explicit line saying the diff is not applied.
## Tests
One bullet per test named in the plan: \`"<test name>" → expected evidence\`. Mark \`NOT RUN\` for any test you could not execute. Never report a pass you did not observe.
## Plan deviations
Anything in the plan that is infeasible as written and why. If a step must change, stop and surface it here instead of silently deviating — an empty section means the plan was followed exactly.
## Follow-ups

Approved plan and any connected inputs:
{{inputs}}`;

/**
 * Stage 5 (Review) — completeness against the plan plus adversarial review
 * passes. The artifact ends with a fenced JSON findings block that the app
 * parses (lib/sdlc.ts parseFindings, with a Markdown-table fallback); any
 * undismissed `blocking` finding locks this gate and blocks the Merge stage.
 */
export const SDLC_REVIEW_SYSTEM_PROMPT = `You are a staff reviewer running Stage 5 (Review) of a gated SDLC pipeline. You check the implementation against the plan, then review for bugs, security, and style/compliance against the supplied skills. Every finding gets a severity: blocking, important, or nit. Output the Markdown report, then exactly one fenced json findings block.`;

export const SDLC_REVIEW_PROMPT = `Review the implementation artifact below.

Passes:
1. Completeness against the plan — every planned file and step present; say so explicitly if no plan is among the inputs.
2. Correctness and bugs.
3. Security.
4. Style and compliance against the skills / rule sets supplied below.
5. Whether the test evidence actually proves the planned tests.

Output:
## Summary
## Findings
A Markdown table: | severity | description | location |  (severity is exactly one of: blocking, important, nit; location is \`path:line\` or a short pointer). Write "None" when you found nothing.
## Test evidence assessment
## Residual risk

Then, as the very last thing in your reply, ONE \`\`\`json fenced block containing the same findings as an array (no text after it):
[{"severity":"blocking","description":"...","location":"src/x.ts:42"}]

The implementation, the plan, and any connected inputs:
{{inputs}}`;

/**
 * Stage 6 (Merge) — the app cannot merge: the artifact is the record a human
 * merges (commit message + PR body), and approving it IS the recorded ship
 * decision. Always a hard gate.
 */
export const SDLC_MERGE_SYSTEM_PROMPT = `You are preparing Stage 6 (Merge) of a gated SDLC pipeline. You never claim a merge happened — you produce the record a human merges. Output Markdown only.`;

export const SDLC_MERGE_PROMPT = `Prepare the merge record for the change that has passed the earlier gates.

Sections:
## Pre-merge checklist
One bullet per gate, stating what was satisfied (intent approved, spec decisions resolved, plan names a test per decision, implementation evidence, review findings dismissed or resolved) and, if an input is missing, say \`NOT PROVIDED\` for it rather than assuming it passed.
## Change summary
## Commit message
A conventional-commit subject line, then the body.
## PR title and body
Description, test plan, risk and rollback.
## Manual follow-ups after merge

Connected inputs:
{{inputs}}`;

/**
 * One message in a Chatbot box's ongoing conversation. Persisted in the
 * box's `chatMessages` and shared across the board — several people talk to
 * the same companion, so user messages carry `by` (displayName).
 */
export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  /** Epoch ms. */
  at: number;
  /** Display name of who said it (user messages only; omitted = unknown). */
  by?: string;
}

/**
 * The six stages of the gated SDLC pipeline. Each stage is one box type; the
 * stage order, hard-gate rules and gate evaluation live in
 * `client/src/lib/sdlc.ts`.
 */
export type SdlcStage = "intent" | "spec" | "plan" | "implementation" | "review" | "merge";

/**
 * Gate state of an SDLC stage box. Absent = the stage has produced no artifact
 * yet. `stale` means the box (or an upstream stage) was regenerated after an
 * approval, so the approval no longer counts for the stages below it.
 */
export type SdlcGateState = "pending" | "approved" | "changes_requested" | "rejected" | "stale";

/**
 * One immutable artifact version of an SDLC stage. Regeneration appends a new
 * version — an existing version is never rewritten or removed (the whole point
 * of the pipeline is traceability).
 */
export interface SdlcVersion {
  version: number;
  content: string;
  /** Epoch ms when the version was created. */
  createdAt: number;
  /** Display name of whoever produced it. */
  createdBy: string;
  /** Whether the model generated it or a human edited the artifact. */
  source: "generated" | "edited";
  /** The change request this version was regenerated from ("" otherwise). */
  note: string;
}

/** One append-only audit event of an SDLC stage box. */
export interface SdlcEvent {
  /** Epoch ms. */
  at: number;
  actor: string;
  /** e.g. "approved spec v2", "requested changes on plan v1". */
  action: string;
  /** Always a string — Firestore rejects `undefined` in a nested object. */
  note: string;
}

/** One structured review finding parsed from the Review box's artifact. */
export interface SdlcFinding {
  id: string;
  severity: "blocking" | "important" | "nit";
  description: string;
  /** `path:line` or a short pointer ("" when the model gave none). */
  location: string;
  dismissed: boolean;
  dismissedBy: string;
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
  /** For Code boxes: the generated React component code (JSX). */
  code?: string;
  /** Token usage from the most recent LLM call for this box (text AI boxes). */
  tokens?: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** For Agent boxes: the step log of the most recent (or current) run. */
  agentSteps?: AgentStep[];
  /** For Chatbot boxes: the ongoing conversation (shared per board). */
  chatMessages?: ChatMessage[];
  /** For Chatbot boxes: the user-provided persona description. */
  personality?: string;
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
   * SDLC stage boxes (see client/src/lib/sdlc.ts). Versions and history are
   * append-only, and every object stored in them has all of its keys defined —
   * Firestore rejects `undefined` anywhere inside a nested value.
   */
  sdlcVersions?: SdlcVersion[];
  sdlcHistory?: SdlcEvent[];
  /** Gate state; absent when the stage has not produced an artifact yet. */
  sdlcGate?: SdlcGateState;
  /** The version the current approval applies to (latest at approval time). */
  sdlcApprovedVersion?: number;
  sdlcApprovedBy?: string;
  /** Epoch ms of the approval. */
  sdlcApprovedAt?: number;
  /** Last "request changes" note — injected into the next regeneration. */
  sdlcFeedback?: string;
  /** Review box: structured findings parsed from the artifact. */
  sdlcFindings?: SdlcFinding[];
  /** Spec box: open questions still unresolved (each one forces the gate). */
  sdlcOpenItems?: string[];
  /** Plan box: spec decisions that have no named test in the plan. */
  sdlcGaps?: string[];
  /** Implementation box: the artifact reports a deviation from the plan. */
  sdlcDeviation?: boolean;
  /**
   * Whether downstream stages must wait for this stage's approval. Default
   * true; locked on for Intent/Merge and whenever a forced-gate condition
   * applies (the app refuses to turn it off rather than silently allowing it).
   */
  sdlcGateRequired?: boolean;
  /** Org rule sets (security, brand, compliance) injected into spec/review. */
  skills?: string;
}

/** Metadata for each box type. */
export type BoxCategory = "input" | "worker" | "collab" | "companion" | "custom" | "sdlc";

/**
 * A role/persona a box is aimed at. Boxes tagged `"everyone"` appear in every
 * role view (they are shared pipeline scaffolding). See `docs/BOX_TYPES.md`.
 */
export type BoxRole = "everyone" | "designer" | "developer" | "product" | "sdlc";

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

export const BOX_TYPES: Record<BoxType, BoxTypeMeta> = {
  idea: {
    label: "Idea",
    icon: "💡",
    color: "#fbbf24",
    description: "Write down a basic idea. No AI — just your text.",
    hasAI: false,
    category: "input",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 200,
  },
  agent: {
    label: "Agent",
    icon: "🤖",
    color: "#4f46e5",
    description: "Give the agent a task — it plans, creates boxes on the board, wires and runs them, then reports back.",
    hasAI: true,
    category: "worker",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: AGENT_CONTROLLER_SYSTEM_PROMPT,
    defaultWidth: 400,
    defaultHeight: 480,
  },
  chatbot: {
    label: "Chatbot",
    icon: "🧍",
    color: "#e11d48",
    description: "A stick-figure companion that stands at the bottom of the board, chats with the team, and can see your boxes. Give it a personality!",
    hasAI: true,
    category: "companion",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: CHATBOT_BASE_PROMPT,
    defaultWidth: 130,
    defaultHeight: 180,
  },
  research: {
    label: "Research",
    icon: "🔍",
    color: "#60a5fa",
    description: "Research a topic using AI. Takes input from connected boxes.",
    hasAI: true,
    category: "worker",
    roles: ["everyone"],
    defaultPrompt:
      "Research the following topic thoroughly. Provide key findings, relevant context, market landscape, and potential risks. Format as Markdown with clear headings.\n\nTopic:\n{{input_1}}",
    defaultSystemPrompt:
      "You are a thorough research assistant. Provide well-structured, factual findings in Markdown format. Be concise but comprehensive.",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  summarize: {
    label: "Summarize",
    icon: "📋",
    color: "#a78bfa",
    description: "Combine and summarize multiple inputs into a concise overview.",
    hasAI: true,
    category: "worker",
    roles: ["everyone"],
    defaultPrompt:
      "Synthesize the following inputs into a clear, concise summary. Identify common themes, key points, and any contradictions. Format as Markdown.\n\n{{inputs}}",
    defaultSystemPrompt:
      "You are a synthesis expert. Combine multiple inputs into a clear, concise summary in Markdown format. Highlight key insights.",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  image: {
    label: "Image",
    icon: "🖼️",
    color: "#34d399",
    description: "Upload an image. The image becomes input for downstream boxes.",
    hasAI: false,
    category: "input",
    roles: ["designer"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  documents: {
    label: "Documents",
    icon: "📎",
    color: "#64748b",
    description:
      "Upload PDF, Word, or text files. Their extracted text becomes input for downstream boxes via {{inputs}}.",
    hasAI: false,
    category: "input",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 340,
    defaultHeight: 380,
  },
  cartoon: {
    label: "Cartoon Profile",
    icon: "🎨",
    color: "#f472b6",
    description: "Generate cartoon profile pictures. Connect an Image box for image-to-image, or an Idea box for text-to-image.",
    hasAI: true,
    category: "worker",
    roles: ["designer"],
    defaultPrompt:
      "Cartoon style 3D profile picture of {{input_1}}, colorful, fun, stylized cartoon character, clean simple background, professional avatar",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 380,
  },
  slides: {
    label: "Slides",
    icon: "📊",
    color: "#fb923c",
    description: "Generate a pitch deck from research. Takes input from connected boxes and creates visual slides.",
    hasAI: true,
    category: "worker",
    roles: ["product", "designer"],
    defaultPrompt:
      "Create a 10-slide startup pitch deck from the following research. Each slide should have a clear title and 3-5 concise bullet points.\n\nSlide structure:\n1. Problem — What pain point exists?\n2. Solution — How does your product solve it?\n3. Market Size — How big is the opportunity?\n4. Product — Key features and demo highlights\n5. Business Model — How do you make money?\n6. Traction — Current progress and metrics\n7. Competition — Competitive landscape and advantage\n8. Team — Who is building this?\n9. Financials — Key projections\n10. Ask — What do you need from investors?\n\nOutput as JSON array: [{\"title\": \"...\", \"bullets\": [\"...\", \"...\"], \"notes\": \"...\"}]\n\nResearch:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a pitch deck creator. You create concise, impactful slides from research data. Output ONLY a valid JSON array of slide objects. Each slide has a \"title\" (string), \"bullets\" (array of strings, 3-5 items), and optional \"notes\" (string with speaker notes). Do not include any text before or after the JSON array.",
    defaultWidth: 380,
    defaultHeight: 380,
  },
  code: {
    label: "Code",
    icon: "💻",
    color: "#22d3ee",
    description: "Generate a React prototype from research. Live preview in the box.",
    hasAI: true,
    category: "worker",
    roles: ["developer"],
    defaultPrompt:
      "Create a React prototype for the following requirements. Use React hooks (React.useState, React.useEffect, etc.) and inline styles for all styling. Keep it SIMPLE: use small mock data (3-5 items max), focus on the core UI and interactivity. Do NOT generate extensive data arrays or constant definitions. The output must be a complete working component with the App function and ReactDOM.createRoot render call.\n\nRequirements:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a React developer. You write clean, working React components. Output ONLY JavaScript/JSX code. No HTML wrapper, no script tags, no markdown code blocks, no explanation. Use the React.* API (React.useState, React.useEffect) — do not use import statements. Define a component called App. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />). Use inline styles for all styling. CRITICAL: Keep mock data SMALL (3-5 items maximum). Do NOT generate extensive data arrays, long constant lists, or large data definitions. Focus on the UI component, interactivity, and visual design. The output MUST include the full App component and the ReactDOM.createRoot render call.",
    defaultWidth: 440,
    defaultHeight: 420,
  },
  prd: {
    label: "PRD",
    icon: "📄",
    color: "#818cf8",
    description: "Generate a Product Requirements Document from research. Structures findings into features, user stories, and specs for the Code box.",
    hasAI: true,
    category: "worker",
    roles: ["product"],
    defaultPrompt:
      "Create a Product Requirements Document (PRD) based on the following research and ideas. Structure it with these sections:\n\n## Product Overview\nBrief description of what we are building and why.\n\n## Problem Statement\nWhat pain point does this solve? Who has this problem?\n\n## Target Users\nWho are the primary users? What are their needs?\n\n## Core Features\nList the key features with priority (P0 = must have, P1 = should have, P2 = nice to have).\n\n## User Stories\nWrite 3-5 user stories in the format: As a [user], I want to [action] so that [benefit].\n\n## UI/UX Guidelines\nKey screens, layout considerations, and design principles.\n\n## Technical Requirements\nTechnology stack recommendations, key constraints, and dependencies.\n\n## Success Metrics\nHow will we measure if this product is successful?\n\nResearch & Ideas:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a product manager. You create clear, structured Product Requirements Documents (PRDs) from research and ideas. Format as Markdown with clear headings, bullet points, and numbered lists. Be specific and actionable — this PRD will be used by developers to build a prototype.",
    defaultWidth: 360,
    defaultHeight: 380,
  },
  devplan: {
    label: "Dev Plan",
    icon: "🗺️",
    color: "#14b8a6",
    description: "Transform a PRD into a detailed development plan with components, state, and implementation steps for the Code box.",
    hasAI: true,
    category: "worker",
    roles: ["developer"],
    defaultPrompt:
      "Create a simple development plan for a React prototype based on this PRD. Keep it short and practical.\n\nList:\n1. Components to build (names + 1-line purpose)\n2. State variables (names + types)\n3. Key functions (names + what they do)\n4. Build order (3-5 steps)\n\nThis is for a simple prototype. Use small mock data. Do NOT over-engineer.\n\nPRD:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a pragmatic developer. Create SHORT, simple development plans for React prototypes. Use React hooks and inline styles. Keep everything minimal — this is a prototype, not production. Be concise.",
    defaultWidth: 360,
    defaultHeight: 380,
  },
  ui: {
    label: "UI Design",
    icon: "✨",
    color: "#c026d3",
    description: "Generate beautiful, production-quality React UIs with Tailwind CSS.",
    hasAI: true,
    category: "worker",
    roles: ["designer"],
    defaultPrompt:
      "Design a beautiful React UI for the following. Use Tailwind CSS classes for ALL styling (no inline styles). Make it look like a real polished product.\n\nDesign requirements:\n- Modern, clean design with attention to detail\n- Good spacing, typography, and color harmony\n- Use gradients, shadows, rounded corners, and smooth transitions\n- Hover states on interactive elements\n- Include at least one gradient or glassmorphism effect\n- Make it responsive\n- Use small mock data (3-5 items)\n\nOutput ONLY JavaScript/JSX code. Use React hooks (React.useState, React.useEffect). Define a component called App. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />).\n\nDescription:\n{{inputs}}",
    defaultSystemPrompt:
      "You are an expert UI designer and React developer. You create beautiful, modern, production-quality user interfaces using Tailwind CSS classes. Focus on visual polish: gradients, shadows, rounded corners, good typography, proper spacing, and smooth transitions. Make it look like a real product — not a demo. Output ONLY JavaScript/JSX code. Use the React.* API. Define App component. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />).",
    defaultWidth: 440,
    defaultHeight: 420,
  },
  stitch: {
    label: "Stitch UI",
    icon: "🧵",
    color: "#0ea5e9",
    description: "Generate beautiful UI screens using Google Stitch. Returns production-quality HTML directly.",
    hasAI: true,
    category: "worker",
    roles: ["designer"],
    defaultPrompt:
      "Generate a beautiful, modern UI screen for the following. Make it polished and production-ready with good spacing, typography, and visual design.\n\nDescription:\n{{inputs}}",
    defaultSystemPrompt: "",
    defaultWidth: 440,
    defaultHeight: 420,
  },
  // === SDLC pipeline (six gated stages, ordered) ===
  // These boxes are the pipeline described in the app's SDLC blueprint: each
  // one produces exactly one artifact, approvals are recorded on the box, and
  // downstream stages refuse to run until their upstream stage is approved.
  // The stage order, hard gates and gate evaluation live in lib/sdlc.ts.
  "sdlc-intent": {
    label: "1 · Intent",
    icon: "🎯",
    color: "#7c3aed",
    description: "Stage 1 of 6 — turn a raw change request into an intent document (problem, outcome, affected systems, constraints) while keeping every open question visible. Always a hard gate.",
    hasAI: true,
    category: "sdlc",
    roles: ["sdlc"],
    defaultPrompt: SDLC_INTENT_PROMPT,
    defaultSystemPrompt: SDLC_INTENT_SYSTEM_PROMPT,
    defaultWidth: 420,
    defaultHeight: 460,
  },
  "sdlc-spec": {
    label: "2 · Spec",
    icon: "📐",
    color: "#4338ca",
    description: "Stage 2 of 6 — resolve every open question from the approved intent with an explicit rule, applying your org skills (security, brand, compliance). Unresolved items force the gate.",
    hasAI: true,
    category: "sdlc",
    roles: ["sdlc"],
    defaultPrompt: SDLC_SPEC_PROMPT,
    defaultSystemPrompt: SDLC_SPEC_SYSTEM_PROMPT,
    defaultWidth: 420,
    defaultHeight: 460,
  },
  "sdlc-plan": {
    label: "3 · Plan",
    icon: "🧭",
    color: "#0e7490",
    description: "Stage 3 of 6 — plan-only: files to change, implementation order, a named test for every spec decision, and risks. The app flags any decision with no test before you review it.",
    hasAI: true,
    category: "sdlc",
    roles: ["sdlc"],
    defaultPrompt: SDLC_PLAN_PROMPT,
    defaultSystemPrompt: SDLC_PLAN_SYSTEM_PROMPT,
    defaultWidth: 420,
    defaultHeight: 460,
  },
  "sdlc-implement": {
    label: "4 · Implementation",
    icon: "🛠️",
    color: "#15803d",
    description: "Stage 4 of 6 — execute the approved plan: the diff plus the evidence for each planned test. Anything infeasible as written surfaces as a deviation instead of a silent change.",
    hasAI: true,
    category: "sdlc",
    roles: ["sdlc"],
    defaultPrompt: SDLC_IMPLEMENT_PROMPT,
    defaultSystemPrompt: SDLC_IMPLEMENT_SYSTEM_PROMPT,
    defaultWidth: 420,
    defaultHeight: 460,
  },
  "sdlc-review": {
    label: "5 · Review",
    icon: "🔎",
    color: "#b45309",
    description: "Stage 5 of 6 — check the diff against the plan, then review for bugs, security and compliance. Findings are tagged blocking / important / nit; blocking findings block the merge until dismissed.",
    hasAI: true,
    category: "sdlc",
    roles: ["sdlc"],
    defaultPrompt: SDLC_REVIEW_PROMPT,
    defaultSystemPrompt: SDLC_REVIEW_SYSTEM_PROMPT,
    defaultWidth: 420,
    defaultHeight: 460,
  },
  "sdlc-merge": {
    label: "6 · Merge",
    icon: "🚀",
    color: "#be123c",
    description: "Stage 6 of 6 — the merge record: pre-merge checklist, commit message, PR body. Nothing ships silently: approving this stage is the recorded human ship decision.",
    hasAI: true,
    category: "sdlc",
    roles: ["sdlc"],
    defaultPrompt: SDLC_MERGE_PROMPT,
    defaultSystemPrompt: SDLC_MERGE_SYSTEM_PROMPT,
    defaultWidth: 420,
    defaultHeight: 460,
  },
  note: {
    label: "Note",
    icon: "🗒️",
    color: "#fbbf24",
    description: "A post-it style note for team communication. Everyone on the board sees it.",
    hasAI: false,
    category: "collab",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 260,
    defaultHeight: 240,
  },
  label: {
    label: "Label",
    icon: "🏷️",
    color: "#64748b",
    description: "A simple colored text label to annotate areas of the board.",
    hasAI: false,
    category: "collab",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 200,
    defaultHeight: 64,
  },
  timer: {
    label: "Timer",
    icon: "⏱️",
    color: "#06b6d4",
    description: "A shared countdown clock. Anyone can start/stop it; everyone sees the same time.",
    hasAI: false,
    category: "collab",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 260,
    defaultHeight: 190,
  },
  custom: {
    label: "Custom",
    icon: "✨",
    color: "#6366f1",
    description: "A reusable AI box you created (saved to your profile).",
    hasAI: true,
    category: "custom",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 320,
  },
};

/** Preset pill colors for Label boxes (index 0 = default). */
export const LABEL_COLORS = ["#e2e8f0", "#fde68a", "#fecdd3", "#a5f3fc", "#a7f3d0"];

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