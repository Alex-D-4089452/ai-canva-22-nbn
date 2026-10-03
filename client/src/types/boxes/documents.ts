import type { BoxTypeMeta } from "../core.js";

export const documentsBox: BoxTypeMeta = {
  label: "Documents",
  icon: "📎",
  color: "#64748b",
  description:
    "Upload PDF, Word, or text files. Their extracted text becomes input for downstream boxes via {{inputs}}.",
  hasAI: false,
  category: "input",
  roles: ["everyone"],
  defaultPrompt: "",
  defaultSystemPrompt: "",
  defaultWidth: 340,
  defaultHeight: 380,
};
