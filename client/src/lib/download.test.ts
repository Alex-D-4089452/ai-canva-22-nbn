import { describe, expect, it } from "vitest";
import type { BoxData } from "../types/index.js";
import { hasDownloadableOutcome, outcomeFilename, outcomeMime, outcomeText, slugifyFilename } from "./download.js";

function data(patch: Partial<BoxData> = {}): BoxData {
  return { content: "", prompt: "", systemPrompt: "", output: "", status: "idle", ...patch } as BoxData;
}

describe("slugifyFilename", () => {
  it("lowercases, strips punctuation and collapses dashes", () => {
    expect(slugifyFilename("My  Research Box!")).toBe("my-research-box");
    expect(slugifyFilename("Béta / Gamma")).toBe("beta-gamma");
    expect(slugifyFilename("---Trim---")).toBe("trim");
  });

  it("caps the length and never returns an empty name", () => {
    const long = "a".repeat(200);
    expect(slugifyFilename(long).length).toBeLessThanOrEqual(60);
    expect(slugifyFilename("!!!")).toBe("box");
    expect(slugifyFilename("")).toBe("box");
  });
});

describe("outcomeFilename", () => {
  it("uses the box type for the text boxes and the label for custom ones", () => {
    expect(outcomeFilename("research", "Research Box")).toBe("research.md");
    expect(outcomeFilename("summarise", "Summarise Box")).toBe("summary.md");
    expect(outcomeFilename("prd", "PRD Box")).toBe("prd.md");
    expect(outcomeFilename("agent", "Agent Box")).toBe("agent-answer.md");
    expect(outcomeFilename("slides", "Slides Box")).toBe("slides.md");
    expect(outcomeFilename("custom", "Security Review Lite")).toBe("security-review-lite.md");
  });
});

describe("hasDownloadableOutcome", () => {
  it("covers the text-output family only", () => {
    for (const type of ["research", "summarise", "prd", "agent", "slides", "custom"]) {
      expect(hasDownloadableOutcome(type)).toBe(true);
    }
    for (const type of ["idea", "image", "documents", "cartoon", "ui", "stitch", "note", "label", "timer", "checklist"]) {
      expect(hasDownloadableOutcome(type)).toBe(false);
    }
  });
});

describe("outcomeText", () => {
  it("returns the generated output for text boxes, newline terminated", () => {
    expect(outcomeText("research", data({ output: "# Findings" }))).toBe("# Findings\n");
  });

  it("returns nothing when the box has not run yet", () => {
    expect(outcomeText("research", data())).toBe("");
    expect(outcomeText("research", data({ output: "   " }))).toBe("");
  });

  it("renders a slide deck as Markdown", () => {
    const deck = outcomeText(
      "slides",
      data({
        output: "raw json",
        slides: [
          { title: "Problem", bullets: ["A", "B"] },
          { title: "Solution", bullets: ["C"], notes: "say this" },
        ],
      })
    );
    expect(deck).toContain("## 1. Problem");
    expect(deck).toContain("- A");
    expect(deck).toContain("## 2. Solution");
    expect(deck).toContain("> say this");
  });

  it("falls back to the raw output when there are no parsed slides", () => {
    expect(outcomeText("slides", data({ output: "no slides parsed" }))).toBe("no slides parsed\n");
  });

  it("downloads everything as Markdown", () => {
    expect(outcomeMime("research")).toContain("markdown");
    expect(outcomeMime("slides")).toContain("markdown");
  });
});
