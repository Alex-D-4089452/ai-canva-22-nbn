/**
 * Probe: does a real mouse move create the user's OWN presence doc
 * (cursor-write path), and how fast does it show up in activeUsers?
 *
 * Run: node probe-presence.mjs   (from client/, `npm run dev` up)
 * Signs in as the reusable test user B, opens its own board, moves the
 * mouse, and watches the store. Deletes the board it creates.
 */
import { chromium } from "playwright-core";
import { resolveChrome } from "./chrome.mjs";

const APP = "http://localhost:5173";
const PW = "E2e-Test-2025!";
const USER = "e2e-b@test.local";

const browser = await chromium.launch({ executablePath: resolveChrome(), headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const log = (...a) => console.log("[pp]", ...a);
page.on("console", (m) => {
  const t = m.text();
  if (/Presence subscription error|updatePresence|presence/i.test(t)) console.log("  <page>", t.slice(0, 200));
});
page.on("pageerror", (e) => console.log("  <pageerror>", String(e).slice(0, 200)));

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
}, { em: USER, pw: PW });
log("signed in:", email);

// Own board (clean canvas → pane everywhere).
await page.evaluate(() => window.__dsh.useBoardStore.getState().createNewBoard("Presence Probe"));
const boardId = await page
  .waitForFunction(() => window.__dsh.useBoardStore.getState().currentBoardId, null, { timeout: 45000 })
  .then(() => page.evaluate(() => window.__dsh.useBoardStore.getState().currentBoardId))
  .catch(() => null);
log("board:", boardId);
await page.waitForTimeout(1500); // subscription established

const snapshot = (tag) =>
  page.evaluate((t) => {
    const s = window.__dsh.useBoardStore.getState();
    const u = window.__dsh.useAuthStore.getState().user;
    return {
      tag: t,
      me: u?.email,
      active: s.activeUsers.map((x) => ({ e: x.email, hasCursor: x.hasCursor, x: x.cursorX })),
      boardId: s.currentBoardId,
    };
  }, tag);

log("before moves:", JSON.stringify(await snapshot("before")));

// Two mouse moves over the EMPTY pane — (500,350) sits under the default-open
// "How to use" card, whose events never reach the React Flow wrapper.
await page.mouse.move(800, 130, { steps: 10 });
await page.waitForTimeout(400);
await page.mouse.move(860, 160, { steps: 5 });
for (const wait of [500, 1500, 3000]) {
  await page.waitForTimeout(wait === 500 ? 500 : 1000);
  const s = await snapshot(`t+${wait}`);
  const mine = s.active.some((x) => x.e === USER);
  log(`after moves (${wait}ms): mine=${mine}`, JSON.stringify(s.active));
  if (mine) break;
}

// Wait for the first heartbeat tick too (≤15s after subscribe).
const ticked = await page
  .waitForFunction(
    (em) => window.__dsh.useBoardStore.getState().activeUsers.some((u) => u.email === em),
    USER,
    { timeout: 16000 }
  )
  .then(() => true)
  .catch(() => false);
log("own presence visible by heartbeat window (≤16s):", ticked);

await page.evaluate(async (id) => {
  const fs = await import("/src/lib/firestore.ts");
  await fs.deleteBoard(id);
}, boardId);
log("board deleted");
await browser.close();
