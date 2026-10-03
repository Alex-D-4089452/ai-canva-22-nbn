import type { BoxTypeMeta } from "../core.js";

export const checklistBox: BoxTypeMeta = {
  label: "Checklist",
  icon: "✅",
  color: "#059669",
  description: "A shared team to-do list. Anyone can add, assign and tick off tasks — everyone sees the same list.",
  hasAI: false,
  category: "collab",
  roles: ["everyone"],
  defaultPrompt: "",
  defaultSystemPrompt: "",
  defaultWidth: 400,
  defaultHeight: 420,
};
