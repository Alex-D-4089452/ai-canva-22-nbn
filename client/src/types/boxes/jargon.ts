import type { BoxTypeMeta } from "../core.js";

export const jargonBox: BoxTypeMeta = {
  label: "Jargon Translator",
  icon: "🔁",
  color: "#8b5cf6",
  description: "Translate an artefact from one role's language into another's (BA jargon → plain English, UX → acceptance criteria).",
  hasAI: true,
  category: "worker",
  // Any role can move work between roles.
  roles: ["everyone"],
  defaultPrompt:
    // Include {{inputs}} in the prompt to pass the source artefact into the translation.
    "Translate the following artefact from one role's specialised language into clear, direct language for another role (e.g. BA jargon → plain English, UX requirements → acceptance criteria). Preserve every requirement, fact and constraint — do not add, drop, or soften anything. Structure the answer as:\n\n## Terms Simplified\nA numbered list of every piece of jargon or role-specific language in the source, each with its plain-language equivalent.\n\n## Translated Artefact\nThe full artefact rewritten for the receiving role, in plain language.\n\nArtefact:\n{{inputs}}",
  defaultSystemPrompt:
    "You are a cross-functional translator who moves work between roles — business analyst, designer, content writer, developer. Explain jargon precisely and stay faithful to the source: never invent requirements, decisions, or constraints that are not in the original. Format as clean Markdown and use a numbered list only under '## Terms Simplified'.",
  defaultWidth: 360,
  defaultHeight: 380,
};
