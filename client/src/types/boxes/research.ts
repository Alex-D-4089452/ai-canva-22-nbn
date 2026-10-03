import type { BoxTypeMeta } from "../core.js";

export const researchBox: BoxTypeMeta = {
  label: "Research",
  icon: "🔍",
  color: "#60a5fa",
  description: "Research a topic using AI. Takes input from connected boxes.",
  hasAI: true,
  category: "worker",
  roles: ["everyone"],
  defaultPrompt:
    "Research the following topic thoroughly. Provide key findings, relevant context, market landscape, and potential risks. Format as Markdown with clear headings.\n\nTopic:\n{{input_1}}",
  defaultSystemPrompt:
    "You are a thorough research assistant. Provide well-structured, factual findings in Markdown format. Be concise but comprehensive.",
  defaultWidth: 400,
  defaultHeight: 400,
};
