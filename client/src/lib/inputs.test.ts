import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import type { BoxData } from "../types.js";
import { collectInputs, imageReferenceText } from "./inputs.js";

function node(id: string, title: string): Node {
  return { id, position: { x: 0, y: 0 }, data: { title } } as Node;
}

describe("imageReferenceText", () => {
  it("passes HTTP(S) URLs through", () => {
    expect(imageReferenceText("https://pub.example/boards/b/images/x.jpg")).toBe(
      "[image: https://pub.example/boards/b/images/x.jpg]"
    );
  });
  it("does not inline local data URLs", () => {
    const out = imageReferenceText("data:image/jpeg;base64,AAAA");
    expect(out).toContain("local only");
    expect(out).not.toContain("base64");
  });
});

describe("collectInputs", () => {
  const nodes = [
  node("idea1", "Idea"),
  node("img1", "Shot"),
  node("img2", "Shot 2"),
  node("run1", "Research"),
];
  const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target });

  it("includes an image-only source as a named input (HTTP URL)", () => {
    const boxData: Record<string, BoxData> = {
      img1: { imageData: "https://cdn.example/a.jpg" } as BoxData,
    };
    const { namedInputs, inputImage } = collectInputs(
      nodes,
      [edge("img1", "run1")],
      boxData,
      "run1"
    );
    expect(inputImage).toBe("https://cdn.example/a.jpg");
    expect(namedInputs).toEqual([
      { name: "Shot", output: "[image: https://cdn.example/a.jpg]" },
    ]);
  });

  it("summarizes a local-only data URL without inlining it", () => {
    const boxData: Record<string, BoxData> = {
      img1: { imageData: "data:image/png;base64,XXXX" } as BoxData,
    };
    const { namedInputs } = collectInputs(nodes, [edge("img1", "run1")], boxData, "run1");
    expect(namedInputs[0].output).toContain("local only");
    expect(namedInputs[0].output).not.toContain("XXXX");
  });

  it("keeps text output and appends the image reference", () => {
    const boxData: Record<string, BoxData> = {
      img1: { output: "alt text", imageData: "https://cdn.example/a.jpg" } as BoxData,
    };
    const { namedInputs } = collectInputs(nodes, [edge("img1", "run1")], boxData, "run1");
    expect(namedInputs[0].output).toContain("alt text");
    expect(namedInputs[0].output).toContain("[image: https://cdn.example/a.jpg]");
  });

  it("uses the first image as inputImage and still collects text", () => {
    const boxData: Record<string, BoxData> = {
      idea1: { content: "Build an agent." } as BoxData,
      img1: { imageData: "https://cdn.example/a.jpg" } as BoxData,
      img2: { imageData: "https://cdn.example/b.jpg" } as BoxData,
    };
    const { namedInputs, inputImage } = collectInputs(
      nodes,
      [edge("idea1", "run1"), edge("img1", "run1"), edge("img2", "run1")],
      boxData,
      "run1"
    );
    expect(namedInputs.map((n) => n.name)).toEqual(["Idea", "Shot", "Shot 2"]);
    expect(inputImage).toBe("https://cdn.example/a.jpg");
  });

  it("skipSelf excludes the box's own content", () => {
    const boxData: Record<string, BoxData> = {
      run1: { content: "my task" } as BoxData,
    };
    const withSelf = collectInputs(nodes, [], boxData, "run1");
    const withoutSelf = collectInputs(nodes, [], boxData, "run1", { skipSelf: true });
    expect(withSelf.namedInputs).toHaveLength(1);
    expect(withoutSelf.namedInputs).toHaveLength(0);
  });

  it("prefers documents text over empty output", () => {
    const boxData: Record<string, BoxData> = {
      idea1: {
        documents: [
          {
            id: "d1",
            name: "spec.md",
            size: 3,
            ext: "md",
            url: "",
            text: "abc",
            chars: 3,
            truncated: false,
            error: "",
          },
        ],
      } as unknown as BoxData,
    };
    const { namedInputs } = collectInputs(nodes, [edge("idea1", "run1")], boxData, "run1");
    expect(namedInputs[0].output).toContain("spec.md");
  });
});
