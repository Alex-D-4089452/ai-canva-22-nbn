import type { BoxTypeMeta } from "../core.js";

export const timerBox: BoxTypeMeta = {
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
};
