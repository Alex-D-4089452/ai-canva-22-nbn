import type { BoxTypeMeta } from "../core.js";

export const summariseBox: BoxTypeMeta = {
  label: "Summarise",
  icon: "📋",
  color: "#a78bfa",
  description: "Combine and summarise multiple inputs into a concise overview.",
  hasAI: true,
  category: "worker",
  roles: ["everyone"],
  defaultPrompt:
    "Synthesise the following inputs into a clear, concise summary. Identify common themes, key points, and any contradictions. Format as Markdown.\n\n{{inputs}}",
  defaultSystemPrompt:
    "You are a synthesis expert. Combine multiple inputs into a clear, concise summary in Markdown format. Highlight key insights.",
  defaultWidth: 400,
  defaultHeight: 400,
};
