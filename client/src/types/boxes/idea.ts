import type { BoxTypeMeta } from "../core.js";

export const ideaBox: BoxTypeMeta = {
  label: "Idea",
  icon: "💡",
  color: "#fbbf24",
  description: "Write down a basic idea. No AI — just your text.",
  hasAI: false,
  category: "input",
  roles: ["everyone"],
  defaultPrompt: "",
  defaultSystemPrompt: "",
  defaultWidth: 400,
  defaultHeight: 250,
};
