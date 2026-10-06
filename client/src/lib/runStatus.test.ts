import { describe, expect, it } from "vitest";
import { runStatusLabel } from "./runStatus.js";

describe("runStatusLabel", () => {
  it("says the box has not run yet when there is no timestamp and no done state", () => {
    expect(runStatusLabel(undefined, false)).toBe("Not run yet");
    expect(runStatusLabel(0, false)).toBe("Not run yet");
  });

  it("shows the run date and time once a timestamp exists", () => {
    const label = runStatusLabel(Date.UTC(2026, 9, 3, 4, 5), true);
    expect(label.startsWith("Ran at ")).toBe(true);
    // Locale formatting varies, but the label always carries digits.
    expect(label).toMatch(/\d/);
  });

  it("falls back to a bare 'Ran' for legacy boxes without a timestamp", () => {
    expect(runStatusLabel(undefined, true)).toBe("Ran");
  });
});
