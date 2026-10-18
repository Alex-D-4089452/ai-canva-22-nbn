import { describe, expect, it } from "vitest";
import type { BoxData } from "../types/index.js";
import { boxStatus, hasRun, resolveBoxType } from "./status.js";

describe("resolveBoxType", () => {
  it("maps the legacy summarize spelling to summarise", () => {
    expect(resolveBoxType("summarize")).toBe("summarise");
  });
  it("passes known types through and rejects unknown ones", () => {
    expect(resolveBoxType("research")).toBe("research");
    expect(resolveBoxType("area")).toBeNull();
    expect(resolveBoxType(undefined)).toBeNull();
  });
});

describe("hasRun", () => {
  it("is true once ranAt (or a legacy timestamp / done status) exists", () => {
    expect(hasRun(undefined)).toBe(false);
    expect(hasRun({} as BoxData)).toBe(false);
    expect(hasRun({ ranAt: 123 } as BoxData)).toBe(true);
    expect(hasRun({ handoffGeneratedAt: 1 } as BoxData)).toBe(true);
    expect(hasRun({ alignmentRanAt: 1 } as BoxData)).toBe(true);
    expect(hasRun({ status: "done" } as BoxData)).toBe(true);
  });
});

describe("boxStatus — input boxes", () => {
  it("documents: no file / all uploaded / partially usable", () => {
    expect(boxStatus("documents", undefined)).toEqual({ tone: "idle", text: "No file yet" });
    const docs = [
      { id: "a", name: "a.txt", chars: 5, size: 5, ext: "txt" },
      { id: "b", name: "b.txt", chars: 5, size: 5, ext: "txt" },
    ] as BoxData["documents"];
    expect(boxStatus("documents", { documents: docs } as BoxData)).toEqual({
      tone: "success",
      text: "2 of 2 uploaded",
    });
    const mixed = [...docs!, { id: "c", name: "c.pdf", chars: 0, size: 1, ext: "pdf", error: "boom" }];
    expect(boxStatus("documents", { documents: mixed } as BoxData)).toEqual({
      tone: "warning",
      text: "2 of 3 uploaded",
    });
  });

  it("media: falls back from files to image to typed idea", () => {
    expect(boxStatus("media", undefined)).toEqual({ tone: "idle", text: "No input yet" });
    expect(boxStatus("media", { content: "  " } as BoxData)).toEqual({
      tone: "idle",
      text: "No input yet",
    });
    expect(boxStatus("media", { content: "an app" } as BoxData)).toEqual({
      tone: "success",
      text: "Idea typed",
    });
    expect(boxStatus("media", { imageData: "https://x/a.jpg" } as BoxData)).toEqual({
      tone: "success",
      text: "Image uploaded",
    });
  });

  it("idea and image report typed-vs-empty", () => {
    expect(boxStatus("idea", undefined).tone).toBe("idle");
    expect(boxStatus("idea", { content: "hello" } as BoxData).text).toBe("Idea ready");
    expect(boxStatus("image", undefined).text).toBe("No image yet");
    expect(boxStatus("image", { imageData: "https://x/a.jpg" } as BoxData).tone).toBe("success");
  });
});

describe("boxStatus — worker boxes", () => {
  it("not run yet / running / done / error", () => {
    expect(boxStatus("research", undefined)).toEqual({ tone: "idle", text: "Not run yet" });
    expect(boxStatus("research", { status: "running" } as BoxData)).toEqual({
      tone: "info",
      text: "Running…",
    });
    expect(boxStatus("research", { status: "done", ranAt: 1759790000000 } as BoxData)).toEqual({
      tone: "success",
      text: "Done",
    });
    const err = boxStatus("research", { status: "error", error: "model offline" } as BoxData);
    expect(err.tone).toBe("danger");
    expect(err.text).toContain("model offline");
  });

  it("alignment reports how many of its two inputs it has", () => {
    expect(boxStatus("alignment", undefined, 1).text).toBe("Not run yet · has 1 of 2 inputs");
    expect(boxStatus("alignment", undefined, 2)).toEqual({ tone: "idle", text: "Not run yet" });
  });

  it("upstream-gated boxes show 'Not connected' until fed", () => {
    expect(boxStatus("handoff", undefined, 0)).toEqual({ tone: "warning", text: "Not connected" });
    expect(boxStatus("handoff", undefined, 1)).toEqual({ tone: "idle", text: "Not run yet" });
    expect(boxStatus("cartoon", undefined, 0).tone).toBe("warning");
  });

  it("truncates very long errors for the pill", () => {
    const long = "x".repeat(200);
    const st = boxStatus("research", { status: "error", error: long } as BoxData);
    expect(st.text.length).toBeLessThanOrEqual(74);
  });
});
