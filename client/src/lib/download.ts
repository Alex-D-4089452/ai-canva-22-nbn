import type { BoxData, BoxType } from "../types/index.js";

/**
 * Downloading a box's actual outcome.
 *
 * `outcomeText` / `outcomeFilename` are pure and unit-tested; `downloadText` is
 * the DOM side (same shape as `downloadHtml` in lib/code.ts).
 */

/** Per-type file names for the download of a box's output. */
const OUTCOME_FILENAMES: Partial<Record<BoxType, string>> = {
  research: "research.md",
  summarise: "summary.md",
  prd: "prd.md",
  agent: "agent-answer.md",
  slides: "slides.md",
};

/** Lowercases, strips diacritics/punctuation and collapses runs of dashes. */
export function slugifyFilename(name: string): string {
  const slug = (name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "box";
}

/**
 * The file name a box's outcome is downloaded as: the box type for the known
 * text boxes, and the slugified instance label for custom boxes.
 */
export function outcomeFilename(type: BoxType | string, label: string): string {
  const known = OUTCOME_FILENAMES[type as BoxType];
  if (known) return known;
  return `${slugifyFilename(label)}.md`;
}

/** Slides are data, not text — render the deck as readable Markdown. */
function slidesToMarkdown(data: BoxData): string {
  const slides = data.slides || [];
  if (slides.length === 0) return data.output || "";
  return slides
    .map((slide, i) => {
      const head = `## ${i + 1}. ${slide.title || "Untitled slide"}`;
      const bullets = (slide.bullets || []).map((b) => `- ${b}`).join("\n");
      const notes = slide.notes ? `\n\n> ${slide.notes}` : "";
      return [head, bullets].filter(Boolean).join("\n") + notes;
    })
    .join("\n\n");
}

/** True when this box type has an outcome that can be downloaded as text. */
export function hasDownloadableOutcome(type: BoxType | string): boolean {
  return ["research", "summarise", "prd", "agent", "slides", "custom"].includes(type);
}

/**
 * The box's **actual outcome** and nothing else: the generated text, or the
 * slide deck rendered as Markdown. "" when the box has produced nothing yet —
 * the caller hides the button in that case.
 */
export function outcomeText(type: BoxType | string, data: BoxData): string {
  if (type === "slides") {
    const deck = slidesToMarkdown(data);
    if (deck.trim()) return deck.trim() + "\n";
    return "";
  }
  const text = (data.output || "").trim();
  return text ? data.output + "\n" : "";
}

/** The MIME type a box's outcome should be downloaded as. */
export function outcomeMime(_type: BoxType | string): string {
  return "text/markdown;charset=utf-8";
}

/** Triggers a browser download of a text file. */
export function downloadText(text: string, filename: string, mime = "text/markdown;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
