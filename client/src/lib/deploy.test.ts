import { describe, expect, it } from "vitest";
import type { BoxData } from "../types.js";
import {
  MAX_DEPLOY_FILE_BYTES,
  canDeployCode,
  deployBlockedReason,
  deployBytes,
  deployFilesFor,
  deploySiteTitle,
  hasDeployableCode,
  validateDeploySet,
} from "./deploy.js";

function data(patch: Partial<BoxData> = {}): BoxData {
  return { content: "", prompt: "", systemPrompt: "", output: "", status: "idle", ...patch } as BoxData;
}

const CODE = "function App() {\n  return <h1>Hi</h1>;\n}\nReactDOM.createRoot(document.getElementById('root')).render(<App />);";

describe("canDeployCode / hasDeployableCode / deployBlockedReason", () => {
  it("covers the code-bearing boxes only", () => {
    for (const type of ["ui", "stitch"]) expect(canDeployCode(type), type).toBe(true);
    for (const type of ["idea", "research", "prd", "slides", "cartoon", "note", "checklist", "agent", "code", "codeedit"]) {
      expect(canDeployCode(type), type).toBe(false);
    }
  });

  it("needs code before anything can be published", () => {
    expect(hasDeployableCode("ui", data({ code: CODE }))).toBe(true);
    expect(hasDeployableCode("ui", data())).toBe(false);
    expect(hasDeployableCode("stitch", data({ code: "<h1>ui</h1>" }))).toBe(true);
    expect(hasDeployableCode("codeedit", data({ code: CODE }))).toBe(false);

    expect(deployBlockedReason("idea", data())).toMatch(/no code/);
    expect(deployBlockedReason("ui", data())).toMatch(/Generate code first/);
    expect(deployBlockedReason("ui", data({ code: CODE }))).toBe("");
  });
});

describe("deployFilesFor", () => {
  it("publishes a UI Design box as a self-contained index.html plus its source", () => {
    const files = deployFilesFor("ui", data({ code: CODE }));
    expect(files.map((f) => f.path)).toEqual(["index.html", "App.jsx"]);
    expect(files[0].content).toContain("<!DOCTYPE html>");
    expect(files[1].content).toBe(CODE + "\n");
  });

  it("wraps a UI Design box with Tailwind, and publishes Stitch HTML as-is", () => {
    const ui = deployFilesFor("ui", data({ code: "const App = () => <div className=\"p-4\" />;" }));
    expect(ui[0].content).toContain("cdn.tailwindcss.com");

    const stitch = deployFilesFor("stitch", data({ code: "<html><body>screen</body></html>" }));
    expect(stitch).toEqual([{ path: "index.html", content: "<html><body>screen</body></html>" }]);
  });

  it("publishes an empty set when there is no code", () => {
    expect(deployFilesFor("ui", data())).toEqual([]);
    expect(deployFilesFor("ui", data({ code: "   " }))).toEqual([]);
    expect(deployFilesFor("idea", data({ code: CODE }))).toEqual([]);
    expect(deployFilesFor("ui", undefined)).toEqual([]);
  });
});

describe("validateDeploySet / deployBytes", () => {
  it("measures utf-8 bytes and accepts a normal set", () => {
    expect(deployBytes([{ path: "a", content: "abc" }])).toBe(3);
    expect(deployBytes([{ path: "a", content: "héllo" }])).toBe(6); // é is two bytes
    expect(validateDeploySet([{ path: "index.html", content: "<h1>ok</h1>" }])).toBe("");
  });

  it("refuses an empty set and an oversized file", () => {
    expect(validateDeploySet([])).toMatch(/nothing to publish/);
    const huge = "x".repeat(MAX_DEPLOY_FILE_BYTES + 1);
    expect(validateDeploySet([{ path: "huge.bin", content: huge }])).toMatch(/per-file limit/);
  });
});

describe("deploySiteTitle", () => {
  it("names the site after the box and describes where it came from", () => {
    const title = deploySiteTitle("ui", data({ content: "a counter with   big buttons" }), "Counter Box", "Demo board");
    expect(title.displayName).toBe("Counter Box");
    expect(title.displayDescription).toContain("AI Canva (UI Design box)");
    expect(title.displayDescription).toContain("Demo board");
    expect(title.displayDescription).toContain("a counter with big buttons"); // whitespace collapsed
    expect(deploySiteTitle("ui", data(), "", "").displayName).toBe("UI Design Box");
    expect(deploySiteTitle("stitch", data(), "Screens", "b").displayDescription).toContain("Stitch UI");
  });

  it("caps the fields to here.now's limits", () => {
    const long = "x".repeat(200);
    const title = deploySiteTitle("ui", data({ content: long }), long, long);
    expect(title.displayName.length).toBeLessThanOrEqual(80);
    expect(title.displayDescription.length).toBeLessThanOrEqual(280);
  });
});
