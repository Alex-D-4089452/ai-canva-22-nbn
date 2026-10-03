import type { BoxTypeMeta } from "../core.js";

export const noteBox: BoxTypeMeta = {
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
};
