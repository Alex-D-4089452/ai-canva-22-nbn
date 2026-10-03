import type { BoxTypeMeta } from "../core.js";

export const imageBox: BoxTypeMeta = {
  label: "Image",
  icon: "🖼️",
  color: "#34d399",
  description: "Upload an image. The image becomes input for downstream boxes.",
  hasAI: false,
  category: "input",
  roles: ["designer"],
  defaultPrompt: "",
  defaultSystemPrompt: "",
  defaultWidth: 400,
  defaultHeight: 400,
};
