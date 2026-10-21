import { describe, expect, it } from "vitest";
import { staleModifierKeys } from "./modifiers.js";

const flags = (
  overrides: Partial<Record<"shiftKey" | "ctrlKey" | "metaKey" | "altKey", boolean>> = {}
) => ({
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...overrides,
});

describe("staleModifierKeys", () => {
  it("releases a latched Shift when the pointer says it is up", () => {
    expect(staleModifierKeys(new Set(["Shift"]), flags())).toEqual([
      { key: "Shift", code: "ShiftLeft" },
    ]);
  });

  it("keeps modifiers that are actually held", () => {
    expect(staleModifierKeys(new Set(["Shift"]), flags({ shiftKey: true }))).toEqual([]);
  });

  it("releases every latched modifier a screenshot chord can leave behind", () => {
    expect(staleModifierKeys(new Set(["Shift", "Control", "Meta"]), flags())).toEqual([
      { key: "Shift", code: "ShiftLeft" },
      { key: "Control", code: "ControlLeft" },
      { key: "Meta", code: "MetaLeft" },
    ]);
  });

  it("ignores keys we were not tracking", () => {
    expect(staleModifierKeys(new Set(["a"]), flags())).toEqual([]);
  });
});
