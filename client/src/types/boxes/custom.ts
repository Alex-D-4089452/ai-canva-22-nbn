import type { BoxTypeMeta } from "../core.js";

export const customBox: BoxTypeMeta = {
  label: "Custom",
  icon: "✨",
  color: "#6366f1",
  description: "A reusable AI box you created (saved to your profile).",
  hasAI: true,
  category: "custom",
  roles: ["everyone"],
  defaultPrompt: "",
  defaultSystemPrompt: "",
  defaultWidth: 400,
  defaultHeight: 400,
};
