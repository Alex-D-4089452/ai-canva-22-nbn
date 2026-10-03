import type { BoxTypeMeta } from "../core.js";

export const stitchBox: BoxTypeMeta = {
  label: "Stitch UI",
  icon: "🧵",
  color: "#0ea5e9",
  description: "Generate beautiful UI screens using Google Stitch. Returns production-quality HTML directly.",
  hasAI: true,
  category: "worker",
  roles: ["designer"],
  defaultPrompt:
    "Generate a beautiful, modern UI screen for the following. Make it polished and production-ready with good spacing, typography, and visual design.\n\nDescription:\n{{inputs}}",
  defaultSystemPrompt: "",
  defaultWidth: 550,
  defaultHeight: 520,
};
