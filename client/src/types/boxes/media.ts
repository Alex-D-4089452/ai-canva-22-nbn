import type { BoxTypeMeta } from "../core.js";

export const mediaBox: BoxTypeMeta = {
  label: "Input",
  icon: "📥",
  color: "#f59e0b",
  description:
    "One box for every kind of input: type an idea, upload documents, or upload an image — all flows to downstream boxes.",
  hasAI: false,
  category: "input",
  roles: ["everyone"],
  defaultPrompt: "",
  defaultSystemPrompt: "",
  defaultWidth: 440,
  defaultHeight: 560,
};
