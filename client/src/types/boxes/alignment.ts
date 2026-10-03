import type { BoxTypeMeta } from "../core.js";

export const alignmentBox: BoxTypeMeta = {
  label: "Alignment Check",
  icon: "✅",
  color: "#b45309",
  description: "Compare two role artifacts for agreement, gaps, and drift.",
  hasAI: true,
  category: "worker",
  // Everyone role aligns with the alignment check: all roles can use it to compare artefacts.
  roles: ["everyone"],
  defaultPrompt:
    // Include {{input_1}} and {{input_2}} in the prompt to pass the two artefacts into the alignment check.
    "Compare the following two artefacts and identify where they agree, where they conflict, and where one has gaps the other should address. Structure as:\n\n## Areas of Alignment\nWhat the two artefacts agree on.\n\n## Conflicts / Drift\nWhere the artefacts contradict each other or pull in different directions. Quote or reference specific sections.\n\n## Gaps\nWhat one artefact covers that the other is missing.\n\n## Recommendations\nConcrete next steps to resolve conflicts and fill gaps.\n\nArtefact 1:\n{{input_1}}\n\nArtefact 2:\n{{input_2}}",
  defaultSystemPrompt:
    "You are a requirements analyst who compares cross-functional artefacts for consistency. Be specific — quote or paraphrase the conflicting parts rather than saying 'they differ'. Identify root causes of drift, not just symptoms. Format as clean Markdown.",
  defaultWidth: 480,
  defaultHeight: 500,
};
