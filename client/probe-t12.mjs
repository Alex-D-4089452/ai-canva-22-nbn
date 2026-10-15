/**
 * Standalone probe for E2E "T12 note edit syncs A → B live".
 *
 * Replicates T9 → T10 → reload → T12's edit for user A only (no user B), with
 * SYNCHRONOUS instrumentation around the edit so a failure distinguishes:
 *   (a) textarea missing (the evaluate would throw — reported instead),
 *   (b) input event dispatched but React's onChange never fired
 *       (store unchanged immediately after dispatch),
 *   (c) onChange fired but the local store got REVERTED later
 *       (store new right after, old again seconds later).
 *
 * Run: node probe-t12.mjs   (from client/, `npm run dev` up)
 * Deletes the board it creates when finished (self-cleaning).
 */
import { chromium } from "playwright-core";
import { resolveChrome } from "./chrome.mjs";

const APP = "http://localhost:5173";
const PW = "E2e-Test-2025!";
const USER_A = "e2e-a@test.local";

const browser = await chromium.launch({ executablePath: resolveChrome(), headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const log = (...a) => console.log("[probe]", ...a);
page.on("console", (m) => {
  const t = m.text();
  if (/\[sync\]|\[store\] Subscribing|\[save\]|\[load\]/.test(t)) console.log("  <page>", t.slice(0, 200));
});

await page.goto(APP, { waitUntil: "load" });
await page.waitForTimeout(1500);

const email = await page.evaluate(async ({ em, pw }) => {
  const m = await import("/src/lib/auth.ts");
  try {
    await m.createTestAccount(em, pw);
  } catch (e) {
    if (!/email-already-in-use/.test(e?.message || "")) throw e;
    await m.signInTestAccount(em, pw);
  }
  return (window.__dsh.useAuthStore.getState().user || {}).email || null;
}, { em: USER_A, pw: PW });
log("signed in:", email);

// Self-cleaning: delete leftover boards from earlier runs (incl. this probe's).
await page.evaluate(() => window.__dsh.useBoardStore.getState().refreshBoardList());
await page.waitForTimeout(2000);
await page.evaluate(async (ownerEmail) => {
  const fs = await import("/src/lib/firestore.ts");
  const s = window.__dsh.useBoardStore.getState();
  for (const b of s.boardList) if (b.ownerEmail === ownerEmail) await fs.deleteBoard(b.id);
  window.__dsh.useBoardStore.setState({ currentBoardId: null, boardList: [] });
}, USER_A);

await page.evaluate(() => window.__dsh.useBoardStore.getState().createNewBoard("T12 Probe"));
const boardId = await page
  .waitForFunction(() => window.__dsh.useBoardStore.getState().currentBoardId, null, { timeout: 45000 })
  .then(() => page.evaluate(() => window.__dsh.useBoardStore.getState().currentBoardId));
log("board:", boardId);

// Add a Note via the palette.
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim().endsWith("Note"));
  btn && btn.click();
});
await page.waitForTimeout(700);
const noteId = await page.evaluate(() => {
  const s = window.__dsh.useBoardStore.getState();
  const hit = Object.entries(s.boxData).find(([, v]) => v.authorEmail === "e2e-a@test.local");
  return hit ? hit[0] : null;
});
log("noteId:", noteId);

// T10's edit (pre-reload) — the known-good baseline.
await page.evaluate(({ id, text }) => {
  const el = document.querySelector(".note-textarea");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, { id: noteId, text: "Persisted across reload!" });
await page.waitForTimeout(2500);
const preReload = await page.evaluate((id) => window.__dsh.useBoardStore.getState().boxData[id]?.content, noteId);
log("pre-reload store:", JSON.stringify(preReload));

// Reload — real auth persists, board comes back from Firestore.
await page.reload({ waitUntil: "load" });
const restored = await page
  .waitForFunction(
    (id) => {
      const s = window.__dsh.useBoardStore.getState();
      return s.currentBoardId && s.boxData[id]?.content === "Persisted across reload!" ? true : null;
    },
    noteId,
    { timeout: 45000 }
  )
  .then(() => true)
  .catch(() => false);
log("board restored after reload:", restored);

// Wait for the note's textarea to actually mount (the canvas can come up
// slightly after the store restores — the suite naturally has a long gap
// here because user B signs in first).
const taWaitStart = Date.now();
const taReady = await page
  .waitForFunction(() => document.querySelectorAll(".note-textarea").length > 0, null, { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
log("textarea ready:", taReady, `after ${Date.now() - taWaitStart}ms`);
// Mimic the real suite's T11 gap (user B signs in first) — pass a delay in
// ms via argv[2]; 0 (default) is the deterministic failure configuration the
// bug used to reproduce in (initial snapshot races the edit).
const delay = Number(process.argv[2] || 0);
if (delay) log(`waiting ${delay}ms like the suite's T11 gap...`);
await page.waitForTimeout(delay);

// ---- T12's edit, instrumented synchronously ----
const probe = await page.evaluate(({ id }) => {
  const els = document.querySelectorAll(".note-textarea");
  const out = { els: els.length };
  const el = els[0];
  if (!el) return out;
  const store = () => window.__dsh.useBoardStore.getState().boxData[id]?.content;
  out.domBefore = el.value;
  out.storeBefore = store();
  let inputsSeen = 0;
  const counter = (e) => { if (e.target === el) inputsSeen++; };
  window.addEventListener("input", counter, true);
  try {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, "Edited live by A!");
  } catch (e) {
    out.setterError = e.message;
    window.removeEventListener("input", counter, true);
    return out;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  out.inputsSeen = inputsSeen;
  out.domAfterDispatch = el.value;
  out.storeSyncAfterDispatch = store(); // React's onChange is sync during dispatch
  window.removeEventListener("input", counter, true);
  return out;
}, { id: noteId });
log("sync probe:", JSON.stringify(probe, null, 1));

await page.waitForTimeout(3000);
const t3 = await page.evaluate((id) => {
  const s = window.__dsh.useBoardStore.getState();
  return { store: s.boxData[id]?.content, save: s.saveStatus };
}, noteId);
log("t+3s:", JSON.stringify(t3));

await page.waitForTimeout(12000);
const t15 = await page.evaluate((id) => {
  const s = window.__dsh.useBoardStore.getState();
  return { store: s.boxData[id]?.content, save: s.saveStatus };
}, noteId);
log("t+15s:", JSON.stringify(t15));

// Self-cleaning.
await page.evaluate(async (id) => {
  const fs = await import("/src/lib/firestore.ts");
  await fs.deleteBoard(id);
}, boardId);
log("board deleted");

await browser.close();
