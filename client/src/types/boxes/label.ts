import type { BoxTypeMeta } from "../core.js";

export const labelBox: BoxTypeMeta = {
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
};

/** Preset pill colors for Label boxes (index 0 = default). */
export const LABEL_COLORS = ["#e2e8f0", "#fde68a", "#fecdd3", "#a5f3fc", "#a7f3d0"];
