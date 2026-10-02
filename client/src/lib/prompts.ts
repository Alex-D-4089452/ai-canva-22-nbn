import type { NamedInput } from "../types/index.js";

/**
 * Fills a prompt template's variables with upstream box outputs.
 *
 * Supported variable syntax (processed in order):
 * 1. {{inputs}}     — all inputs concatenated, labeled by box name
 * 2. {{input}}      — first input's output (backward compat)
 * 3. {{input_N}}    — Nth input's output, positional (backward compat)
 * 4. {{Box Name}}   — match by connected box name (case-insensitive)
 *
 * @param template The prompt template string
 * @param inputs Array of named upstream inputs
 * @returns The filled prompt string
 */
export function fillPromptTemplate(
  template: string,
  inputs: NamedInput[]
): string {
  let filled = template;

  // 1. Replace {{inputs}} with all inputs labeled by box name
  filled = filled.replace(/\{\{inputs\}\}/g, () => {
    if (inputs.length === 0) return "[no inputs]";
    return inputs
      .map((inp) => inp.name + ":\n" + inp.output.trim())
      .join("\n\n---\n\n");
  });

  // 2. Replace {{input}} as alias for first input
  filled = filled.replace(/\{\{input\}\}/g, () => {
    return inputs[0]?.output.trim() || "[no input]";
  });

  // 3. Replace {{input_N}} with the Nth input (1-indexed, positional)
  filled = filled.replace(/\{\{input_(\d+)\}\}/g, (_match, num) => {
    const idx = parseInt(num, 10) - 1;
    return inputs[idx]?.output.trim() || "[no input]";
  });

  // 4. Replace {{Box Name}} — match by connected box name (case-insensitive)
  // Match any {{...}} that hasn't been resolved yet
  filled = filled.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmed = varName.trim();
    // Case-insensitive match against connected box names
    const found = inputs.find(
      (inp) => inp.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (found) return found.output.trim();
    // No match — leave as-is so the user sees the unresolved variable
    return match;
  });

  return filled;
}

/**
 * Returns the output text from a box — generated output for AI boxes,
 * or user content for idea boxes.
 */
export function getBoxOutput(output: string, content: string): string {
  return output || content;
}
