import type { BoxTypeMeta } from "../core.js";

export const prdBox: BoxTypeMeta = {
  label: "PRD",
  icon: "📄",
  color: "#818cf8",
  description: "Generate a Product Requirements Document from research. Structures findings into features, user stories, and specs.",
  hasAI: true,
  category: "worker",
  roles: ["product"],
  defaultPrompt:
    "Create a Product Requirements Document (PRD) based on the following research and ideas. Structure it with these sections:\n\n## Product Overview\nBrief description of what we are building and why.\n\n## Problem Statement\nWhat pain point does this solve? Who has this problem?\n\n## Target Users\nWho are the primary users? What are their needs?\n\n## Core Features\nList the key features with priority (P0 = must have, P1 = should have, P2 = nice to have).\n\n## User Stories\nWrite 3-5 user stories in the format: As a [user], I want to [action] so that [benefit].\n\n## UI/UX Guidelines\nKey screens, layout considerations, and design principles.\n\n## Technical Requirements\nTechnology stack recommendations, key constraints, and dependencies.\n\n## Success Metrics\nHow will we measure if this product is successful?\n\nResearch & Ideas:\n{{inputs}}",
  defaultSystemPrompt:
    "You are a product manager. You create clear, structured Product Requirements Documents (PRDs) from research and ideas. Format as Markdown with clear headings, bullet points, and numbered lists. Be specific and actionable — this PRD will be used by developers to build a prototype.",
  defaultWidth: 360,
  defaultHeight: 380,
};
