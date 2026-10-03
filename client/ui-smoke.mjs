/**
 * Live UI smoke test for AI change requests in the UI Design box, here.now box
 * deploys (UI + Stitch) and the per-box outcome downloads.
 * Drives the REAL dev app (localhost:5173) with /api/generate mocked at the
 * page level so the artifacts are deterministic.
 *
 * Run: node ui-smoke.mjs
 */
import { chromium } from "playwright-core";

const APP = "http://localhost:5173";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
};

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));

await page.goto(APP, { waitUntil: "load" });
await page.waitForTimeout(2000);

// ---- seed a fake user (dev-only hooks) ----
await page.evaluate(() => {
  window.__dsh.useAuthStore.setState({
    user: { uid: "smoke-uid", email: "smoke@test.local", displayName: "Smoke Tester", photoURL: "" },
    loading: false,
  });
});
await page.waitForTimeout(1500);

// ---- mock /api/generate with deterministic artifacts ----
// (A function because a reload would wipe injected mocks.)
const installMocks = () => page.evaluate(() => {
  const original = window.fetch;
  window.__smoke = { prompts: [], calls: 0 };
  window.fetch = async (url, opts) => {
    const u = typeof url === "string" ? url : url.url;
    if (u.includes("/api/generate")) {
      const body = JSON.parse(opts?.body || "{}");
      const prompt = body.userPrompt || "";
      window.__smoke.prompts.push(prompt);
      window.__smoke.calls++;
      const content = "# Artifact\nnot a known stage";
      return new Response(
        JSON.stringify({ content, model: "smoke-model", usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return original(url, opts);
  };
  // Keep a way to restore.
  window.__restoreFetch = () => { window.fetch = original; };
});
await installMocks();

// ---------- UI box: AI change requests (diff + version history) ----------

// The UI Design box talks to /api/generate directly; this mock serves a first
// build and then an AI change, so the whole flow is deterministic.
await page.evaluate(() => {
  window.__cc = { calls: 0, prompts: [] };
  window.__ccReply = { mode: "ok" };
  const original = window.fetch;
  window.installCodeChangeMocks = () => {
    window.fetch = async (url, opts) => {
      const u = typeof url === "string" ? url : url.url;
      if (!u.includes("/api/generate")) return original(url, opts);
      const body = JSON.parse(opts?.body || "{}");
      const prompt = body.userPrompt || "";
      window.__cc.calls++;
      window.__cc.prompts.push(prompt);
      if (window.__ccReply.mode === "incomplete") {
        return new Response(JSON.stringify({
          content: "function App() { return <div>truncated", model: "mock",
          usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (window.__ccReply.mode === "same") {
        return new Response(JSON.stringify({
          content: window.__ccFixture.built, model: "mock",
          usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const isChange = prompt.includes("Apply ONLY that change");
      const content = isChange ? window.__ccFixture.changed : window.__ccFixture.built;
      return new Response(JSON.stringify({
        content, model: "mock", usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
  };
  window.__ccFixture = {
    built: "function App() {\n  return (\n    <div>\n      <h1>Hi</h1>\n      <button>Count</button>\n    </div>\n  );\n}\nReactDOM.createRoot(document.getElementById('root')).render(<App />);",
    changed: "function App() {\n  return (\n    <div>\n      <h1>Hi</h1>\n      <button>Count</button>\n      <input placeholder=\"search\" />\n    </div>\n  );\n}\nReactDOM.createRoot(document.getElementById('root')).render(<App />);",
  };
});
await page.evaluate(() => window.installCodeChangeMocks());

const codeBox = await page.evaluate(() => {
  const s = () => window.__dsh.useBoardStore.getState();
  const box = s().addBox("ui", { x: 80, y: 3000 });
  s().updateBoxData(box, { prompt: "Build it:\n{{inputs}}", content: "a page with a heading and a count button" });
  return box;
});
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), codeBox);
await page.waitForTimeout(900);

let ccState = await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return { status: d.status, error: d.error || "", code: d.code || "", versions: (d.codeVersions || []).length, current: d.codeVersion };
}, codeBox);
check("CC1 the build is versioned (v1) and the code is complete",
  ccState.status === "done" && ccState.versions === 1 && ccState.current === 1 && ccState.code.includes("<h1>Hi</h1>"),
  JSON.stringify({ status: ccState.status, versions: ccState.versions, error: ccState.error }));

const ccNode = await page.evaluate(() => {
  const node = [...document.querySelectorAll(".box-node")].find((n) => n.innerText.includes("UI Design Box"));
  return node ? node.innerText : "";
});
const ccPlaceholder = await page.evaluate(() => {
  const node = [...document.querySelectorAll(".box-node")].find((n) => n.innerText.includes("UI Design Box"));
  return [...node.querySelectorAll("input")].map((el) => el.getAttribute("placeholder") || "").join(" | ");
});
check("CC2 the box offers a change request field and an Apply change button",
  /Request a change/i.test(ccPlaceholder) && /Apply change/i.test(ccNode) && /1 version/.test(ccNode),
  ccPlaceholder.slice(0, 90));

// Apply an AI change.
await page.evaluate((boxId) => {
  const s = () => window.__dsh.useBoardStore.getState();
  s().updateBoxData(boxId, { changePrompt: "add a search field" });
}, codeBox);
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().applyChangeRequest(boxId), codeBox);
await page.waitForTimeout(900);
ccState = await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return {
    status: d.status, error: d.error || "", code: d.code || "",
    versions: (d.codeVersions || []).length, current: d.codeVersion,
    notes: (d.codeVersions || []).map((v) => v.note), cleared: d.changePrompt === "",
  };
}, codeBox);
check("CC3 the AI change updates the code and appends a version",
  ccState.status === "done" && ccState.code.includes("search") && ccState.versions === 2 && ccState.current === 2
  && ccState.notes[1] === "add a search field",
  JSON.stringify({ status: ccState.status, versions: ccState.versions, error: ccState.error }));
check("CC4 the change prompt sent the current code and the request with the keep-everything rules",
  await page.evaluate(() => {
    const p = (window.__cc.prompts || []).filter((x) => x.includes("Apply ONLY that change")).pop() || "";
    return p.includes("<h1>Hi</h1>") && p.includes("add a search field") && p.includes("Return the COMPLETE file");
  }));

const ccAfter = await page.evaluate(() => {
  const node = [...document.querySelectorAll(".box-node")].find((n) => n.innerText.includes("UI Design Box"));
  return node ? node.innerText : "";
});
check("CC5 the box shows the version, the +/- counts and a revert path",
  // The version chip is CSS-uppercased, so match case-insensitively.
  /v2/i.test(ccAfter) && /\+1/.test(ccAfter) && /2 versions/.test(ccAfter)
  && /Diff/.test(ccAfter) && /requested: add a search field/.test(ccAfter),
  ccAfter.slice(0, 150).replace(/\n/g, " / "));

// The history is append-only and a revert is itself a version.
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().revertCodeVersion(boxId, 1), codeBox);
await page.waitForTimeout(500);
ccState = await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return { code: d.code || "", versions: (d.codeVersions || []).length, current: d.codeVersion, notes: (d.codeVersions || []).map((v) => v.note) };
}, codeBox);
check("CC6 reverting restores the old code as a NEW version (history never rewritten)",
  ccState.versions === 3 && ccState.current === 3 && !ccState.code.includes("search")
  && ccState.notes[2] === "reverted to v1",
  JSON.stringify({ versions: ccState.versions, notes: ccState.notes }));

// An incomplete reply must never replace working code.
await page.evaluate(() => { window.__ccReply.mode = "incomplete"; });
await page.evaluate((boxId) => {
  const s = () => window.__dsh.useBoardStore.getState();
  s().updateBoxData(boxId, { changePrompt: "do something odd" });
}, codeBox);
const ccBeforeBad = await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().boxData[boxId].code, codeBox);
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().applyChangeRequest(boxId), codeBox);
await page.waitForTimeout(900);
check("CC7 an incomplete change is refused and the working code is kept", await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return d.status === "error" && /incomplete/i.test(d.error || "") && (d.codeVersions || []).length === 3;
}, codeBox) && (await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().boxData[boxId].code, codeBox)) === ccBeforeBad);

// A reply that changes nothing is reported instead of pretending.
await page.evaluate(() => { window.__ccReply.mode = "same"; });
await page.evaluate((boxId) => {
  const s = () => window.__dsh.useBoardStore.getState();
  s().updateBoxData(boxId, { changePrompt: "change nothing" });
}, codeBox);
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().applyChangeRequest(boxId), codeBox);
await page.waitForTimeout(900);
check("CC8 an unchanged reply adds no version", await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return d.status === "done" && (d.codeVersions || []).length === 3;
}, codeBox));

// A change with no request at all is refused with guidance.
const ccEmpty = await page.evaluate(() => window.__dsh.useBoardStore.getState().addBox("ui", { x: 620, y: 3000 }));
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().applyChangeRequest(boxId), ccEmpty);
check("CC9 a change request with no code (or no request) is refused", await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return d.status === "error" && /Generate the code first/i.test(d.error || "");
}, ccEmpty));

// ---------- Deploy: a box's code published to a live here.now URL ----------

await page.evaluate(() => {
  window.__dep = { requests: [], mode: "ok" };
  const original = window.fetch;
  window.installDeployMocks = () => {
    window.fetch = async (url, opts) => {
      const u = typeof url === "string" ? url : url.url;
      if (!u.includes("/api/herenow-deploy")) return original(url, opts);
      const body = JSON.parse(opts?.body || "{}");
      window.__dep.requests.push(body);
      if (window.__dep.mode === "conflict") {
        return new Response(JSON.stringify({
          error: "The site update: This site has changed since it was deployed (live version ver_9, changed by editor). Redeploy to replace it, or review the live version first.",
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const n = window.__dep.requests.length;
      return new Response(JSON.stringify({
        ok: true,
        slug: "cobalt-castle-y2d3",
        siteUrl: "https://cobalt-castle-y2d3.here.now/",
        versionId: "ver_" + n,
        unchanged: false,
        anonymous: true,
        expiresAt: "2026-09-14T12:39:41.214Z",
        claimToken: "y_Wu0ZyWf-pdH0sP",
        claimUrl: "https://here.now/c/y_Wu0ZyWf-pdH0sP",
        warnings: [],
        fileCount: (body.files || []).length,
        bytes: 3518,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
  };
});
await page.evaluate(() => window.installDeployMocks());

const depBox = await page.evaluate(() => {
  const s = () => window.__dsh.useBoardStore.getState();
  const box = s().addBox("ui", { x: 80, y: 3600 });
  const code = "function App() {\n  return <h1>Deployed</h1>;\n}\nReactDOM.createRoot(document.getElementById('root')).render(<App />);";
  s().setBoxName(box, "Deploy Demo");
  s().updateBoxData(box, {
    code, output: code, status: "done",
    codeVersions: [{ version: 1, content: code, createdAt: Date.now(), createdBy: "T", source: "generated", note: "initial build" }],
    codeVersion: 1,
  });
  return box;
});
await page.waitForTimeout(500);

const depNodeText = await page.evaluate(() => {
  const node = [...document.querySelectorAll(".box-node")].find((n) => n.innerText.includes("Deploy Demo"));
  return node ? node.innerText : "";
});
check("DP1 a UI box offers a Deploy button and a live-site strip",
  /Deploy/.test(depNodeText) && /LIVE SITE/i.test(depNodeText) && /2 file\(s\) ready to publish/.test(depNodeText),
  depNodeText.slice(0, 140).replace(/\n/g, " / "));

await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().deployBox(boxId), depBox);
await page.waitForTimeout(700);

const depState = await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return { status: d.status, error: d.error || "", deploy: d.deploy || null };
}, depBox);
check("DP2 deploying publishes the box's code and records the live site",
  depState.status === "done" && depState.deploy?.url === "https://cobalt-castle-y2d3.here.now/"
  && depState.deploy?.slug === "cobalt-castle-y2d3" && depState.deploy?.versionId === "ver_1"
  && depState.deploy?.claimToken === "y_Wu0ZyWf-pdH0sP" && depState.deploy?.anonymous === true,
  JSON.stringify({ url: depState.deploy?.url, slug: depState.deploy?.slug, error: depState.error }));
check("DP3 the payload carried a self-contained page plus the source",
  await page.evaluate(() => {
    const req = window.__dep.requests[0];
    const paths = req.files.map((f) => f.path);
    const html = req.files.find((f) => f.path === "index.html")?.content || "";
    return JSON.stringify(paths) === JSON.stringify(["index.html", "App.jsx"])
      && html.includes("<!DOCTYPE html>") && html.includes("ReactDOM.createRoot")
      && req.displayName === "Deploy Demo";
  }),
  await page.evaluate(() => JSON.stringify(window.__dep.requests[0].files.map((f) => f.path))));

const depLive = await page.evaluate(() => {
  // Match the DEPLOYED box: several boxes are titled "UI Design Box", so
  // identify this one by its live-site link rather than by title.
  const node = [...document.querySelectorAll(".box-node")].find((n) => n.querySelector("a[href*='here.now']"));
  const link = node?.querySelector("a[href*='here.now']");
  return { text: node ? node.innerText : "", href: link?.getAttribute("href") || "" };
});
check("DP4 the box shows the live URL, the 24-hour expiry and the claim link behind a toggle",
  depLive.href === "https://cobalt-castle-y2d3.here.now/"
  && /Anonymous site/.test(depLive.text) && /expires/.test(depLive.text)
  && /Show claim link/.test(depLive.text),
  depLive.text.slice(0, 150).replace(/\n/g, " / "));

check("DP5 the claim link is revealed with its once-only warning",
  await page.evaluate(async () => {
    const node = [...document.querySelectorAll(".box-node")].find((n) => n.querySelector("a[href*='here.now']"));
    const btn = [...node.querySelectorAll("button")].find((b) => b.textContent.includes("Show claim link"));
    btn?.click();
    await new Promise((r) => setTimeout(r, 200));
    const after = node.innerText;
    return after.includes("https://here.now/c/y_Wu0ZyWf-pdH0sP") && /returned once and cannot be recovered/i.test(after);
  }));

// A redeploy must update the SAME site, sending its version back.
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().deployBox(boxId), depBox);
await page.waitForTimeout(700);
check("DP6 redeploying updates the same site with its claim token and live version",
  await page.evaluate(() => {
    const req = window.__dep.requests[1];
    return req.slug === "cobalt-castle-y2d3" && req.claimToken === "y_Wu0ZyWf-pdH0sP" && req.baseVersionId === "ver_1";
  }),
  await page.evaluate(() => JSON.stringify({ slug: window.__dep.requests[1]?.slug, base: window.__dep.requests[1]?.baseVersionId })));

// A refused update must be surfaced, and the previous site kept.
await page.evaluate(() => { window.__dep.mode = "conflict"; });
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().deployBox(boxId), depBox);
await page.waitForTimeout(700);
check("DP7 a refused update is surfaced and the previous site is kept", await page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  const node = [...document.querySelectorAll(".box-node")].find((n) => n.querySelector("a[href*='here.now']"));
  return d.status === "error" && /changed since it was deployed/.test(d.error || "")
    && d.deploy?.url === "https://cobalt-castle-y2d3.here.now/"
    && /previous site is still live and unchanged/.test(node ? node.innerText : "");
}, depBox));
await page.evaluate(() => { window.__dep.mode = "ok"; });

// Stitch publishes its HTML as-is.
const stitchDeploy = await page.evaluate(async () => {
  const s = () => window.__dsh.useBoardStore.getState();
  const box = s().addBox("stitch", { x: 620, y: 3600 });
  s().updateBoxData(box, { code: "<html><body><h1>Stitch screen</h1></body></html>", status: "done" });
  window.__dep.requests.length = 0;
  await s().deployBox(box);
  return window.__dep.requests[0];
});
check("DP8 a Stitch box publishes its HTML as index.html only",
  stitchDeploy.files.length === 1 && stitchDeploy.files[0].path === "index.html"
  && stitchDeploy.files[0].content.includes("Stitch screen"),
  JSON.stringify(stitchDeploy.files.map((f) => f.path)));

const realErrors = pageErrors.filter((e) => !/Missing or insufficient permissions/i.test(e));
check("Z1 no unexpected page errors", realErrors.length === 0, realErrors.join(" | ").slice(0, 200));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("failed: " + failed.map((f) => f.name).join(", "));
  process.exit(1);
}
