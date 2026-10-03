import type { BoxTypeMeta } from "../core.js";

export const handoffBox: BoxTypeMeta = {
  label: "Handoff Brief",
  icon: "📦",
  color: "#1d4ed8",
  description: "Package one role's output into a clean handoff document for the next role.",
  hasAI: true,
  category: "worker",
  // Product role aligns with the handoff brief: the BA (and product/content roles) own handoffs.
  roles: ["product"],
  defaultPrompt:
    // Include {{inputs}} in the prompt to pass the upstream work into the handoff brief.
    "Create a professional handoff brief from the following work. Structure it as:\n\n## Context\nBrief background and why this work was done.\n\n## What Was Completed\nList the deliverables and key outputs.\n\n## Key Decisions & Rationale\nMajor decisions made and why.\n\n## Open Questions / Risks\nAnything unresolved or risky for the next role.\n\n## Definition of Done\nWhat the next role should verify before considering this work complete.\n\n## Handoff Notes\nAny specific instructions, dependencies, or context the next role needs.\n\nUpstream work:\n{{inputs}}",
  defaultSystemPrompt:
    "You are a project coordinator who creates clear, professional handoff documents. Your briefs ensure the receiving role has everything they need — context, deliverables, decisions, risks, and acceptance criteria. Format as clean Markdown. Be specific and actionable.",
  defaultWidth: 360,
  defaultHeight: 380,
};
