import type { BoxTypeMeta } from "../core.js";

export const cartoonBox: BoxTypeMeta = {
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
  defaultWidth: 400,
  defaultHeight: 480,
};
