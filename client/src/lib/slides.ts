import type { Slide } from "../types/index.js";

/**
 * Parses the LLM's text response into a Slide[] array.
 * Handles JSON wrapped in markdown code blocks and extra text around the JSON.
 *
 * Extracted from boardStore so this deterministic logic can be unit-tested.
 *
 * @param text The AI response text (may contain markdown fencing / prose).
 * @returns A validated array of slides.
 * @throws If no valid JSON array of slide objects can be found.
 */
export function parseSlidesResponse(text: string): Slide[] {
  let jsonText = text.trim();

  // Strip markdown code block wrapper (```json ... ```)
  const codeBlock = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    jsonText = codeBlock[1].trim();
  }

  // Find the JSON array boundaries
  const arrayStart = jsonText.indexOf("[");
  const arrayEnd = jsonText.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    jsonText = jsonText.slice(arrayStart, arrayEnd + 1);
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s) => s && typeof s.title === "string")
        .map((s) => ({
          title: String(s.title),
          bullets: Array.isArray(s.bullets)
            ? s.bullets.map((b: unknown) => String(b))
            : [],
          notes: s.notes ? String(s.notes) : undefined,
        }));
    }
  } catch {
    // JSON parse failed — fall through to error
  }

  throw new Error(
    "Could not parse slides from AI response. Expected a JSON array of slide objects."
  );
}
