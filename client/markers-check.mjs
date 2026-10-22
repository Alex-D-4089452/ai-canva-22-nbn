/**
 * Marker check — a fast, headless verification of the E2E/ui-smoke UI markers
 * that a chrome restyle can silently break, plus a screenshot of the canvas.
 *
 * It boots the REAL dev app (http://localhost:5173), seeds the dev-only fake
 * user (window.__dsh), then asserts every text selector the full suites rely
 * on: palette `endsWith(label)` rows, `Add Box`, section headers, the `▭ Area`
 * tool + its color-picker titles, the "How to use" card, `▶ Run` button
 * counting, header menu markers, the idea placeholder, the new pipeline strip
 * / status pills / bottom bar, plus the palette add → toast Undo flow.
 *
 * Needs no Ollama, no Firebase sign-in, and no Cloudflare — it never runs a
 * model call (Run buttons are only counted, never clicked).
 *
 * Run: node markers-check.mjs   (from client/, `npm run dev` must be up)
 */
import { chromium } from "playwright-core";
import os from "node:os";
import path from "node:path";
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
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 140)));
const bodyText = () => page.evaluate(() => document.body.innerText);

await page.goto(APP, { waitUntil: "load" });
await page.waitForTimeout(2500);
check("landing renders (untouched by the restyle)", /Visual AI pipelines/.test(await bodyText()));
check("landing hides app canvas", !(await page.$(".react-flow")));

// Seed the dev-only fake user (same hook the E2E suite uses).
await page.evaluate(() => {
  window.__dsh.useAuthStore.setState({
    user: { uid: "markers-uid", email: "markers@test.local", displayName: "Marker Tester", photoURL: "" },
    loading: false,
  });
});
await page.waitForTimeout(2500);

// ---------- Shell markers ----------
check("app shell renders + `Add Box` present", !!(await page.$(".react-flow")) && /Add Box/.test(await bodyText()));

// Readable-by-default contract: never open below the 115% floor, and the
// body type scale that was bumped with it (16px base/textarea).
const openingView = await page.evaluate(() => {
  const zoomText = document.querySelector(".bar-zoom-level")?.textContent || "";
  const nodes = Array.from(document.querySelectorAll(".box-node"));
  const node = nodes.find((n) => n.querySelector("textarea")) || nodes[0];
  const textarea = node?.querySelector("textarea");
  return {
    zoom: parseFloat(zoomText),
    base: node ? parseFloat(getComputedStyle(node).fontSize) : 0,
    textarea: textarea ? parseFloat(getComputedStyle(textarea).fontSize) : 0,
  };
});
check(
  "canvas opens at a readable default zoom (>= 115%)",
  openingView.zoom >= 115,
  `${Math.round(openingView.zoom)}%`
);
check(
  "box body uses the larger type scale (>= 16px)",
  openingView.base >= 16 && openingView.textarea >= 16,
  `${openingView.base}px base / ${openingView.textarea}px textarea`
);

// Both overlays start closed; the rail buttons open them independently.
const overlaysClosed = await page.evaluate(() => {
  const panel = document.querySelector(".sidebar-panel");
  const help = Array.from(document.querySelectorAll("div")).find(
    (d) => (d.textContent || "").includes("How to use") && d.className.includes("rounded-xl")
  );
  return {
    palette: !!panel && !panel.classList.contains("translate-x-0"),
    help: !help,
  };
});
check("add-box palette starts closed", overlaysClosed.palette);
check("help card starts closed", overlaysClosed.help);

// Regression: OS/browser shortcuts (Win+Shift+S, Cmd+Shift+5) can swallow the
// keyup React Flow relies on, latching Shift-selection mode. A later pane drag
// must pan, not leave a selection box stuck.
const emptyPoint = await page.evaluate(() => {
  const pane = document.querySelector(".react-flow__pane");
  if (!pane) return null;
  const r = pane.getBoundingClientRect();
  for (let y = r.bottom - 90; y > r.top + 90; y -= 40) {
    for (let x = r.left + 130; x < r.right - 90; x += 40) {
      const el = document.elementFromPoint(x, y);
      if (
        el &&
        pane.contains(el) &&
        !el.closest(
          ".react-flow__node, .react-flow__edge, .react-flow__minimap, .react-flow__controls, .react-flow__panel, button, input, textarea, select, a"
        )
      ) {
        return { x, y };
      }
    }
  }
  return null;
});
let staleShiftOk = false;
let staleShiftDetail = "no empty canvas point";
if (emptyPoint) {
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", bubbles: true }))
  );
  await page.mouse.move(emptyPoint.x - 30, emptyPoint.y - 20);
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.waitForTimeout(80);
  const viewportBefore = await page.evaluate(
    () => document.querySelector(".react-flow__viewport")?.getAttribute("style") || ""
  );
  await page.mouse.down();
  await page.mouse.move(emptyPoint.x + 80, emptyPoint.y - 40, { steps: 8 });
  const selectionVisible = await page.evaluate(
    () => !!document.querySelector(".react-flow__selection")
  );
  await page.mouse.up();
  const viewportAfter = await page.evaluate(
    () => document.querySelector(".react-flow__viewport")?.getAttribute("style") || ""
  );
  staleShiftOk = !selectionVisible && viewportBefore !== viewportAfter;
  staleShiftDetail = `selection=${selectionVisible}, moved=${viewportBefore !== viewportAfter}`;
  if (staleShiftOk) {
    // Put the board back where it started for the screenshot + later checks.
    await page.mouse.move(emptyPoint.x + 80, emptyPoint.y - 40);
    await page.mouse.down();
    await page.mouse.move(emptyPoint.x, emptyPoint.y, { steps: 8 });
    await page.mouse.up();
  }
}
check("stale Shift clears before the next drag (pan, no selection box)", staleShiftOk, staleShiftDetail);

// The reconciliation must not break a REAL Shift-drag selection.
if (emptyPoint) {
  await page.keyboard.down("Shift");
  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.down();
  await page.mouse.move(emptyPoint.x + 70, emptyPoint.y - 30, { steps: 6 });
  const realShiftSelection = await page.evaluate(
    () => !!document.querySelector(".react-flow__selection")
  );
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  check("real Shift still draws a selection box", realShiftSelection);
}

const paletteOpened = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    b.textContent.trim().endsWith("Add Box")
  );
  if (!btn) return false;
  btn.click();
  return true;
});
await page.waitForTimeout(300);
const paletteState = await page.evaluate(() => {
  const panel = document.querySelector(".sidebar-panel");
  const help = Array.from(document.querySelectorAll("div")).find(
    (d) => (d.textContent || "").includes("How to use") && d.className.includes("rounded-xl")
  );
  return {
    panel: !!panel,
    open: panel?.classList.contains("translate-x-0"),
    help: !!help,
    helpText: help?.textContent?.slice(0, 60),
  };
});
check(
  "Add Box opens the palette (without opening help)",
  paletteOpened && paletteState.panel && paletteState.open && !paletteState.help,
  JSON.stringify({ paletteOpened, ...paletteState })
);

const sections = await bodyText();
check(
  "palette sections INPUTS/NBN/WORKERS/COLLABORATION",
  /INPUTS/i.test(sections) &&
    /NBN/i.test(sections) &&
    /WORKERS/i.test(sections) &&
    /COLLABORATION/i.test(sections)
);
const nbnSection = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll(".palette-section"));
  const title = (h) => (h.textContent || "").replace(/\s+/g, " ").trim();
  const labelsIn = (index) => {
    const container = headers[index]?.parentElement;
    return container
      ? Array.from(container.querySelectorAll(".palette-title")).map((el) => el.textContent.trim())
      : [];
  };
  const titles = headers.map(title);
  const inputs = titles.findIndex((t) => t.startsWith("Inputs"));
  const nbn = titles.findIndex((t) => t.startsWith("NBN"));
  const workers = titles.findIndex((t) => t.startsWith("Workers"));
  const nbnLabels = labelsIn(nbn);
  const workerLabels = labelsIn(workers);
  const expected = ["Handoff Brief", "Alignment Check", "Jargon Translator"];
  return {
    belowInputs: nbn === inputs + 1,
    complete: expected.every((label) => nbnLabels.includes(label)),
    movedOutOfWorkers: expected.every((label) => !workerLabels.includes(label)),
  };
});
check(
  "NBN section sits below Inputs and holds the three NBN boxes",
  nbnSection.belowInputs && nbnSection.complete && nbnSection.movedOutOfWorkers,
  JSON.stringify(nbnSection)
);
check("pipeline strip under the header", !!(await page.$(".pipeline-strip")));
check("pipeline chips show real steps", (await page.$$(".strip-chip")).length >= 2);
check("bottom canvas bar with zoom level", /%/.test(await page.textContent(".canvas-bar .bar-zoom-level").catch(() => "")));
check(
  "bottom bar has undo + redo history buttons",
  (await page.$$(".canvas-bar .bar-history-btn")).length === 2
);
check("left canvas rail present", !!(await page.$(".canvas-rail")));

// ---------- Palette row contract (T3/T14) ----------
const endsWithButton = (label) =>
  page.evaluate((l) => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent.trim().endsWith(l)
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, label);

const addViaPalette = async (label) => {
  const before = await page.evaluate(() => window.__dsh.useBoardStore.getState().nodes.length);
  const clicked = await endsWithButton(label);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__dsh.useBoardStore.getState().nodes.length);
  return clicked && after === before + 1;
};

for (const label of ["Note", "Label", "Timer", "Idea", "Research", "Checklist", "Documents"]) {
  check(`palette add: ${label}`, await addViaPalette(label));
}
check(
  "custom box entry button exists (contains New Custom Box)",
  await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).some((b) =>
      (b.textContent || "").includes("New Custom Box")
    )
  )
);

// ---------- Toast + Undo ----------
const toastVisible = !!(await page.$(".canvas-bar .bar-undo"));
check("add toast shows an Undo action", toastVisible);
if (toastVisible) {
  const before = await page.evaluate(() => window.__dsh.useBoardStore.getState().nodes.length);
  await page.click(".canvas-bar .bar-undo");
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__dsh.useBoardStore.getState().nodes.length);
  check("Undo removes the just-added box", after === before - 1);
}

// ---------- Help card (TA marker) ----------
const helpOpened = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll(".canvas-rail button")).find(
    (b) => b.textContent.trim().endsWith("Help")
  );
  if (!btn) return false;
  btn.click();
  return true;
});
await page.waitForTimeout(300);
check(
  "Help opens the help card independently",
  helpOpened &&
    (await page.evaluate(() => {
      const panel = Array.from(document.querySelectorAll("div")).find(
        (d) => (d.textContent || "").includes("How to use") && d.className.includes("rounded-xl")
      );
      const palette = document.querySelector(".sidebar-panel");
      return !!(panel && panel.querySelector("button") && palette?.classList.contains("translate-x-0"));
    }))
);
check(
  "help card highlights the three NBN boxes",
  await page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll("div")).find(
      (d) => (d.textContent || "").includes("How to use") && d.className.includes("rounded-xl")
    );
    const text = panel?.textContent || "";
    return (
      text.includes("NBN cross-functional boxes") &&
      ["Handoff Brief", "Alignment Check", "Jargon Translator"].every((label) =>
        text.includes(label)
      )
    );
  })
);

// ---------- Area tool (TA) ----------
const areaActivated = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /▭ Area$/.test((b.textContent || "").trim())
  );
  if (!btn) return false;
  btn.click();
  return true;
});
check("area tool button matches /▭ Area$/ and activates", areaActivated);
await page.waitForTimeout(300);
const emeraldPicked = await page.evaluate(() => {
  const dot = Array.from(document.querySelectorAll("button")).find((b) =>
    (b.title || "").includes("Draw color — Emerald")
  );
  if (!dot) return false;
  dot.click();
  return true;
});
check("area color picker titles (Draw color — Emerald)", emeraldPicked);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
check(
  "Escape deactivates the area tool (picker gone)",
  !(await page.$(".area-colors"))
);

// ---------- Run-button count contract (T7) ----------
const runCount = await page.evaluate(
  () => Array.from(document.querySelectorAll("button")).filter((b) => /▶ Run/.test(b.textContent)).length
);
const researchCount = await page.evaluate(
  () =>
    window.__dsh.useBoardStore
      .getState()
      .nodes.filter((n) => (n.data.boxType || n.type) === "research").length
);
check("▶ Run button count === research box count", runCount === researchCount, `${runCount}/${researchCount}`);
check(
  "header Run all does not match /▶ Run/",
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Run all")
    );
    return !!btn && !/▶ Run/.test(btn.textContent);
  })
);

// ---------- Header markers ----------
check("header shows 'Boards ('", /Boards \(/.test(await bodyText()));
const boardsBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    (b.textContent || "").includes("Boards (")
  );
  if (!btn) return false;
  btn.click();
  return true;
});
await page.waitForTimeout(400);
check(
  "Boards menu contains 'New Board'",
  await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).some((b) =>
      (b.textContent || "").includes("New Board")
    )
  )
);
check(
  "Boards menu paints over the pipeline strip (header stack above strip)",
  await page.evaluate(() => {
    const strip = document.querySelector(".pipeline-strip");
    const item = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("New Board")
    );
    if (!strip || !item) return false;
    // Climb to the dropdown panel (the first position:absolute ancestor).
    let menu = item.parentElement;
    while (menu && getComputedStyle(menu).position !== "absolute") menu = menu.parentElement;
    if (!menu) return false;
    const sr = strip.getBoundingClientRect();
    const mr = menu.getBoundingClientRect();
    // A point inside BOTH the menu and the strip (the menu hangs over it).
    const x = Math.max(mr.left + 12, sr.left + 8);
    const y = Math.max(mr.top + 6, sr.top + 8);
    if (x > Math.min(mr.right, sr.right) - 6 || y > Math.min(mr.bottom, sr.bottom) - 6)
      return false;
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === menu || menu.contains(hit));
  })
);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// ---------- Box cards ----------
check("floating status pills render", (await page.$$(".box-pill")).length >= 2);
check(
  "idea textarea placeholder contains 'your idea'",
  await page.evaluate(() =>
    Array.from(document.querySelectorAll("textarea")).some((t) =>
      (t.placeholder || "").toLowerCase().includes("your idea")
    )
  )
);
check(
  "box header carries the type tint + icon tile",
  await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll(".box-header"));
    return (
      headers.length >= 2 &&
      headers.every((h) => {
        const bg = h.style.backgroundColor || "";
        return bg !== "" && bg !== "rgb(255, 255, 255)";
      }) &&
      document.querySelectorAll(".box-header .box-icon-tile").length >= 2
    );
  })
);
check(
  "research box pill shows 'Not run yet'",
  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll(".box-pill"));
    return pills.some((p) => p.textContent.includes("Not run yet"));
  })
);
check(
  "in-card run status strip shows 'Not run yet'",
  await page.evaluate(() => {
    const strips = Array.from(document.querySelectorAll(".run-status"));
    return strips.length >= 1 && strips.some((s) => s.textContent.includes("Not run yet"));
  })
);

// ---------- Screenshot for visual review ----------
await page.screenshot({ path: path.join(os.tmpdir(), "relay-restyle.png"), fullPage: false });

// Page errors after the fake-user seed are expected noise (Firestore
// permission rejections, exactly as the E2E suite documents) — report only.
if (pageErrors.length) console.log(`INFO - page errors (expected fake-user noise): ${pageErrors.join(" | ").slice(0, 200)}`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} marker checks passed.`);
console.log(`Screenshot: ${path.join(os.tmpdir(), "relay-restyle.png")}`);
process.exit(failed.length ? 1 : 0);
