/**
 * Undo/redo probe — self-cleaning check of the Ctrl+Z behaviour against the
 * REAL dev app (http://localhost:5173) with the dev-only fake user, no
 * Firebase/Ollama/Cloudflare needed.
 *
 * Covers what the pure history tests can't: the wiring from the keyboard
 * shortcut and the bottom-bar buttons through `boardStore.undo()`/`redo()`,
 * and the sharp edge that Ctrl+Z inside a textarea must stay the BROWSER's
 * text undo, never the board's.
 *
 * Run: node probe-undo.mjs   (from client/, `npm run dev` must be up)
 */
import { chromium } from "playwright-core";
import { resolveChrome } from "./chrome.mjs";

const APP = "http://localhost:5173";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
};

const executablePath = resolveChrome();
if (!executablePath) {
  console.error("No Chrome/Edge found for headless launch.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(APP, { waitUntil: "load" });
await page.waitForTimeout(2000);

// Dev-only fake user (same hook the E2E/markers suites use) → local board.
await page.evaluate(() => {
  window.__dsh.useAuthStore.setState({
    user: { uid: "undo-probe-uid", email: "undo@test.local", displayName: "Undo Probe", photoURL: "" },
    loading: false,
  });
});
await page.waitForTimeout(2000);

const board = () =>
  page.evaluate(() => {
    const s = window.__dsh.useBoardStore.getState();
    return {
      nodes: s.nodes.length,
      title: s.boardTitle,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      boxData: JSON.parse(JSON.stringify(s.boxData)),
    };
  });
const addViaPalette = (label) =>
  page.evaluate((l) => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent.trim().endsWith(l)
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
const flags = () =>
  page.evaluate(() => ({
    undoDisabled: document.querySelector(".canvas-bar .bar-history-btn")?.disabled ?? null,
    redoDisabled:
      document.querySelectorAll(".canvas-bar .bar-history-btn")[1]?.disabled ?? null,
  }));

const before = await board();
check(
  "bottom bar has undo + redo buttons",
  (await page.$$(".canvas-bar .bar-history-btn")).length === 2
);

// ---------- Add a box, undo it, redo it ----------
await addViaPalette("Idea");
await page.waitForTimeout(500);
const added = await board();
check("palette add increases the box count", added.nodes === before.nodes + 1, `${before.nodes} → ${added.nodes}`);
check("undo button enables after an edit", !(await flags()).undoDisabled);

await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
const undone = await board();
check("Ctrl+Z removes the just-added box", undone.nodes === before.nodes, `${added.nodes} → ${undone.nodes}`);
check("redo button enables after an undo", !(await flags()).redoDisabled);

await page.keyboard.press("Control+Shift+z");
await page.waitForTimeout(300);
const redone = await board();
check("Ctrl+Shift+Z brings the box back", redone.nodes === added.nodes, `${undone.nodes} → ${redone.nodes}`);

await page.keyboard.press("Control+y");
await page.waitForTimeout(300);
const redoneY = await board();
check("Ctrl+Y also redoes (nothing left to redo → unchanged)", redoneY.nodes === redone.nodes);

// ---------- Typing: undoable, but only OUTSIDE the field ----------
const boxId = await page.evaluate(() => window.__dsh.useBoardStore.getState().nodes.at(-1).id);
const textarea = `.react-flow__node[data-id="${boxId}"] textarea`;
// Type the way the E2E does it — a native value set + input event, with the
// field focused so the keydown target check sees a real editable element.
await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error("textarea not found: " + sel);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  el.focus();
  setter.call(el, "probe note text");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, textarea);
await page.waitForTimeout(400);
const typed = await board();
const typedContent = typed.boxData[boxId]?.content || "";
check("typing lands in the box", typedContent.includes("probe note text"), JSON.stringify(typedContent.slice(-20)));

// Ctrl+Z WHILE TYPING must stay the browser's text undo — the board is untouched.
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
const inField = await board();
check(
  "Ctrl+Z inside a textarea does not undo the board",
  (inField.boxData[boxId]?.content || "").includes("probe note text"),
  JSON.stringify((inField.boxData[boxId]?.content || "").slice(-20))
);

// Blur the field, then Ctrl+Z steps the board back over the whole typing burst.
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(100);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
const blurred = await board();
check(
  "Ctrl+Z outside the field undoes the typing burst",
  (blurred.boxData[boxId]?.content || "") === "",
  JSON.stringify(blurred.boxData[boxId]?.content || "")
);

// ---------- Walk all the way back, then stop ----------
await page.evaluate(() => window.__dsh.useBoardStore.getState().redo()); // re-apply the text
await page.waitForTimeout(300);
let steps = 0;
for (let i = 0; i < 20; i++) {
  const changed = await page.evaluate(() => window.__dsh.useBoardStore.getState().undo());
  steps++;
  await page.waitForTimeout(120);
  if (!changed) break;
}
const drained = await board();
check(
  "undo drains to the start of the board and then stops",
  !drained.canUndo && drained.nodes < before.nodes,
  `stopped after ${steps} steps at ${drained.nodes} boxes`
);

// The board TITLE is part of the history too.
await page.evaluate(() => window.__dsh.useBoardStore.getState().setBoardTitle("Probe Title"));
await page.waitForTimeout(400);
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);
const titleBack = await board();
check("board title rename is undone", titleBack.title !== "Probe Title", titleBack.title);

console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} undo probe checks passed` +
    (results.some((r) => !r.ok) ? " — FAILURES ABOVE" : "")
);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
