import { describe, expect, it } from "vitest";
import type { BoxData } from "../types.js";
import { cleanBoxDataForFirestore } from "./serialization.js";

describe("cleanBoxDataForFirestore", () => {
  it("drops undefined values entirely", () => {
    const data: Record<string, BoxData> = {
      box1: {
        content: "hi",
        status: "done",
        error: undefined,
        output: "out",
      } as unknown as BoxData,
    };
    const cleaned = cleanBoxDataForFirestore(data);
    expect("error" in cleaned.box1).toBe(false);
    expect(cleaned.box1.content).toBe("hi");
  });

  it("strips base64 imageData but keeps http(s) image URLs", () => {
    const data: Record<string, BoxData> = {
      a: { imageData: "data:image/png;base64,AAAA", content: "x" } as unknown as BoxData,
      b: { imageData: "https://storage.example/a.png", content: "y" } as unknown as BoxData,
    };
    const cleaned = cleanBoxDataForFirestore(data);
    expect("imageData" in cleaned.a).toBe(false);
    expect(cleaned.b.imageData).toBe("https://storage.example/a.png");
  });

  it("preserves other fields unchanged", () => {
    const data: Record<string, BoxData> = {
      b: { content: "c", output: "o", status: "running", tokens: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } } as unknown as BoxData,
    };
    const cleaned = cleanBoxDataForFirestore(data);
    expect(cleaned.b).toEqual(data.b);
  });

  it("keeps a full code-version record intact with no nested undefined", () => {
    const box = {
      content: "make the header sticky",
      prompt: "p",
      systemPrompt: "s",
      output: "```jsx\nconst App = …\n```",
      status: "done",
      code: "const App = () => <header />;",
      codeVersion: 2,
      codeVersions: [
        { version: 1, content: "const App = () => <div />;", createdAt: 1, createdBy: "Ada", source: "generated", note: "initial build" },
        { version: 2, content: "const App = () => <header />;", createdAt: 2, createdBy: "Bo", source: "edited", note: "sticky header" },
      ],
      changePrompt: "",
      deploy: {
        slug: "my-site", url: "https://my-site.here.now/", versionId: "v1", claimToken: "", claimUrl: "",
        anonymous: true, expiresAt: "", deployedAt: 1700000005000, fileCount: 2, bytes: 1234,
        warnings: [], error: "",
      },
    } as unknown as BoxData;

    const cleaned = cleanBoxDataForFirestore({ i: box });
    expect(cleaned.i).toEqual(box);

    // Firestore rejects undefined ANYWHERE in a nested value — walk the whole
    // record the way the SDK would.
    const nested: unknown[] = [];
    const walk = (value: unknown) => {
      if (value === undefined) nested.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(cleaned.i);
    expect(nested).toEqual([]);
  });
});
