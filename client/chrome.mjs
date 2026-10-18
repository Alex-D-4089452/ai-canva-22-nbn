/**
 * Cross-platform system Chrome/Edge resolver shared by the headless suites
 * (e2e.mjs, ui-smoke.mjs, markers-check.mjs).
 *
 * The suites were written on macOS where Chrome lives at the well-known
 * "/Applications/Google Chrome.app/..." path; on Windows the equivalent is
 * Edge (Chromium) or a user-local Chrome. Returns the first candidate that
 * exists on disk, or null (the caller should fail with a clear message).
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES =
  process.platform === "win32"
    ? [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
      ]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          path.join(os.homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
        ];

export function resolveChrome() {
  return CANDIDATES.find((p) => existsSync(p)) || null;
}
