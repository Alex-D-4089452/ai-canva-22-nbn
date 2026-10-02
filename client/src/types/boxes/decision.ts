import type { BoxTypeMeta } from "../core.js";

export const decisionBox: BoxTypeMeta = {
  label: "Decision Log",
  icon: "🗒️",
  color: "#8b5cf6",
  description: "Extract decisions, rationale, and owners from meeting notes into a structured log.",
  hasAI: true,
  category: "worker",
  // Everyone role aligns with the decision log: all roles can use it to capture decisions from meetings.
  roles: ["everyone"],
  defaultPrompt:
    // Include {{inputs}} in the prompt to pass the meeting notes into the decision log.
    "Extract all decisions from the following meeting notes. For each decision, record:\n\n- **Decision** — what was decided\n- **Rationale** — why it was decided this way\n- **Owner** — who is responsible (if mentioned)\n- **Status** — confirmed / tentative / needs follow-up\n\nIf no decisions are found, say so clearly.\n\nMeeting notes:\n{{inputs}}",
  defaultSystemPrompt:
    "You are a meticulous project coordinator who captures decisions from meeting notes. Be precise — use the exact wording from the notes when quoting rationale. If the notes are ambiguous about a decision, mark it 'tentative'. If no owner is named, mark it 'No owner'. Format as clean Markdown with a numbered list of decisions.",
  defaultWidth: 360,
  defaultHeight: 380,
};
