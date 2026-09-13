/**
 * Ad-hoc live smoke test for the SDLC pipeline group + outcome downloads.
 * Drives the REAL dev app (localhost:5173) with /api/generate mocked at the
 * page level so the artifacts are deterministic.
 *
 * Run: node /tmp/sdlc-smoke.mjs
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

// ---- mock /api/generate with stage-specific artifacts ----
await page.evaluate(() => {
  const original = window.fetch;
  window.__smoke = { prompts: [], calls: 0 };
  window.fetch = async (url, opts) => {
    const u = typeof url === "string" ? url : url.url;
    if (u.includes("/api/generate")) {
      const body = JSON.parse(opts?.body || "{}");
      const prompt = body.userPrompt || "";
      window.__smoke.prompts.push(prompt);
      window.__smoke.calls++;
      let content = "# Artifact\nnot a known stage";
      // Most specific prompts first — the review prompt also contains the words
      // "implementation artifact".
      if (prompt.includes("Review the implementation artifact")) {
        content = "# Review\n\n## Summary\nOne blocker.\n\n## Findings\n| severity | description | location |\n|---|---|---|\n| blocking | No rate limit on the SSO callback | api/auth.ts:42 |\n| nit | Typo in a comment | api/auth.ts:80 |\n\n## Test evidence assessment\nTests were NOT RUN — evidence is expected behaviour only.\n\n## Residual risk\nProvider outage.\n\n```json\n[{\"severity\":\"blocking\",\"description\":\"No rate limit on the SSO callback\",\"location\":\"api/auth.ts:42\"},{\"severity\":\"nit\",\"description\":\"Typo in a comment\",\"location\":\"api/auth.ts:80\"}]\n```\n";
      } else if (prompt.includes("Prepare the merge record")) {
        content = "# Merge record: Add SSO\n\n## Pre-merge checklist\n- Intent approved\n- Spec decisions resolved\n\n## Change summary\nSSO for the admin console.\n\n## Commit message\nfeat(auth): add SAML SSO to the admin console\n\n## PR title and body\nSSO.\n\n## Manual follow-ups after merge\nWatch the provider error rate.\n";
      } else if (prompt.includes("implementation plan")) {
        content = "# Plan: Add SSO\n\n## Files to change\n- `api/auth.ts` — add SAML flow\n\n## Implementation order\n1. Add the SAML client\n\n## Tests\n- \"Session length cap\" → proves Decision 1\n\n## Risks\nWide blast radius on the auth middleware.\n\n## Rollback\nFeature flag.\n";
      } else if (prompt.includes("implementation artifact")) {
        content = "# Implementation: Add SSO\n\n## Diff\n```diff\n+ const session = await saml.exchange(assertion);\n```\nApplied to `api/auth.ts`.\n\n## Tests\n- \"Session length cap\" → NOT RUN (no repo access)\n\n## Plan deviations\nStep 1 also needed a new dependency (@node-saml/passport-saml).\n\n## Follow-ups\nTrack the dep.\n";
      } else if (prompt.includes("spec document")) {
        content = "# Spec: Add SSO\n\n## Scope\nAdmin console sign-in.\n\n## Decisions\n### Decision 1 — Session length\nCap sessions at 8 hours.\n\n### Decision 2 — Audit log retention\nKeep audit logs for 400 days.\n\n## Skill constraints applied\n- No PII in logs: constrained the audit record fields.\n\n## Interfaces and data model\nSAML assertion → session.\n\n## Non-functional requirements\np95 login < 2s.\n\n## Acceptance criteria\nStaff can sign in.\n\n## Unresolved\n⚠ Rollout order for the three regions is unknown\n";
      } else if (prompt.includes("intent document")) {
        content = "# Add SSO to the admin console\n\n## Problem statement\n\"Add SSO.\"\n\n## Proposed outcome\nStaff log in with the company IdP.\n\n## Affected users / systems\nAdmin console, identity provider.\n\n## Constraints\nMust ship this quarter.\n\n## Open questions\n- Which identity provider is authoritative?\n- What happens to existing sessions on rollout?\n";
      }
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

// ---- palette: SDLC section with the six stages in order ----
const sidebarText = await page.evaluate(() => document.querySelector(".absolute.right-0")?.innerText || document.body.innerText);
check("P1 palette shows an SDLC section", /\bSDLC\b/.test(sidebarText));
const paletteOrder = await page.evaluate(() => {
  const label = (b) => (b.querySelector("span:last-child")?.textContent || "").trim();
  const rows = [...document.querySelectorAll("button.palette-row")].map(label);
  return rows.filter((r) => /^\d+ · /.test(r));
});
check(
  "P2 palette lists the six stages in order",
  JSON.stringify(paletteOrder) === JSON.stringify(["1 · Intent", "2 · Spec", "3 · Plan", "4 · Implementation", "5 · Review", "6 · Merge"]),
  paletteOrder.join(" | ")
);
check("P3 View profile offers SDLC", await page.evaluate(() => [...document.querySelectorAll("select option")].some((o) => o.value === "sdlc")));

// ---- build the pipeline through the real store actions ----
const ids = await page.evaluate(async () => {
  const s = () => window.__dsh.useBoardStore.getState();
  const idea = s().addBox("idea", { x: 40, y: 40 });
  s().updateBoxData(idea, { content: "Add SSO to the admin console." });
  const intent = s().addBox("sdlc-intent", { x: 380, y: 40 });
  const spec = s().addBox("sdlc-spec", { x: 720, y: 40 });
  const plan = s().addBox("sdlc-plan", { x: 1060, y: 40 });
  const impl = s().addBox("sdlc-implement", { x: 1400, y: 40 });
  const review = s().addBox("sdlc-review", { x: 1400, y: 540 });
  const merge = s().addBox("sdlc-merge", { x: 1060, y: 540 });
  s().connectBoxes(idea, intent);
  s().connectBoxes(intent, spec);
  s().connectBoxes(spec, plan);
  s().connectBoxes(plan, impl);
  s().connectBoxes(impl, review);
  s().connectBoxes(review, merge);
  return { idea, intent, spec, plan, impl, review, merge };
});
check("P4 pipeline wired (6 stages + idea seed)", Object.keys(ids).length === 7);

const stage = (id) => page.evaluate((boxId) => {
  const d = window.__dsh.useBoardStore.getState().boxData[boxId];
  return {
    status: d.status,
    error: d.error || "",
    gate: d.sdlcGate || "",
    versions: (d.sdlcVersions || []).map((v) => v.version),
    output: (d.output || "").slice(0, 60),
    openItems: d.sdlcOpenItems || [],
    gaps: d.sdlcGaps || [],
    deviation: !!d.sdlcDeviation,
    findings: (d.sdlcFindings || []).map((f) => `${f.severity}:${f.dismissed}`),
    history: (d.sdlcHistory || []).map((e) => e.action),
    approvedBy: d.sdlcApprovedBy || "",
    approvedVersion: d.sdlcApprovedVersion ?? null,
    gateRequired: d.sdlcGateRequired,
  };
}, id);

// ---- gate blocks the next stage before any model call ----
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), ids.spec);
let specState = await stage(ids.spec);
check("G1 spec refuses to run before intent is approved", specState.status === "error" && /(not approved|produced no artifact)/i.test(specState.error), specState.error.slice(0, 70));
check("G2 no model call was made for the blocked stage", (await page.evaluate(() => window.__smoke.calls)) === 0);

// ---- run + approve intent ----
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), ids.intent);
let intentState = await stage(ids.intent);
check("G3 intent generated v1 and is pending", intentState.status === "done" && intentState.versions.join() === "1" && intentState.gate === "pending");
check("G4 artifact mirrors the latest version (downstream {{inputs}} keeps working)", intentState.output.startsWith("# Add SSO"));

await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().approveArtifact(boxId), ids.intent);
intentState = await stage(ids.intent);
check("G5 approve records gate, version and approver", intentState.gate === "approved" && intentState.approvedVersion === 1 && intentState.approvedBy === "Smoke Tester");
check("G6 approval is in the audit trail", intentState.history.some((a) => /approved intent v1/.test(a)), intentState.history.join(" | "));

// ---- spec: unresolved item keeps it gated ----
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), ids.spec);
specState = await stage(ids.spec);
check("S1 spec ran after the intent approval", specState.status === "done" && specState.output.startsWith("# Spec"), specState.error);
check("S2 app detected the unresolved item itself", specState.openItems.length === 1 && /Rollout order/.test(specState.openItems[0]), JSON.stringify(specState.openItems));
check("S3 unresolved item forces the gate even with auto-advance turned off", await page.evaluate(async (boxId) => {
  const s = () => window.__dsh.useBoardStore.getState();
  const accepted = s().setSdlcGateRequired(boxId, false);
  const gateOff = s().boxData[boxId].sdlcGateRequired === false;
  return accepted === false && gateOff === false;
}, ids.spec));

check("S4 hard gates refuse auto-advance too", await page.evaluate(async (boxId) => {
  const s = () => window.__dsh.useBoardStore.getState();
  return s().setSdlcGateRequired(boxId, false) === false; // merge
}, ids.merge));

// ---- spec approval → plan, with the app-side test cross-check ----
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().approveArtifact(boxId), ids.spec);
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), ids.plan);
const planState = await stage(ids.plan);
check("S5 plan ran after the spec approval", planState.status === "done" && planState.output.startsWith("# Plan"), planState.error);
check("S6 app cross-checked spec decisions against the plan's tests", planState.gaps.length === 1 && /Audit log retention/.test(planState.gaps[0]), JSON.stringify(planState.gaps));
check("S7 the missing-test gap is recorded in the trail", planState.history.some((a) => /no named test/.test(a)), planState.history.join(" | "));

// ---- edit the plan artifact → new version, downstream invalidation, gap re-derived ----
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().editArtifact(boxId, "# Plan: Add SSO\n\n## Tests\n- \"Session length cap\" → Decision 1\n- \"Audit log retention\" → Decision 2\n", "edited at the gate"), ids.plan);
const editedPlan = await stage(ids.plan);
check("S8 editing appends a new version (never overwrites)", editedPlan.versions.join() === "1,2" && editedPlan.gate === "pending");
check("S9 editing cleared the cross-check once the test was named", editedPlan.gaps.length === 0);
check("S10 edit is attributed in the trail", editedPlan.history.some((a) => /edited plan v2/.test(a)));

// ---- approve plan → implementation (deviation detected) ----
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().approveArtifact(boxId), ids.plan);
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), ids.impl);
const implState = await stage(ids.impl);
check("I1 implementation ran", implState.status === "done" && implState.output.startsWith("# Implementation"), implState.error);
check("I2 app detected the reported plan deviation", implState.deviation === true);

// ---- regenerate the APPROVED intent: downstream approvals go stale ----
await page.evaluate(async (boxId) => { const s = () => window.__dsh.useBoardStore.getState(); await s().runBox(boxId); }, ids.intent);
const intentAfter = await stage(ids.intent);
const specAfter = await stage(ids.spec);
const planAfter = await stage(ids.plan);
check("R1 regenerating intent appends v2 and returns the gate to pending", intentAfter.versions.join() === "1,2" && intentAfter.gate === "pending");
check("R2 downstream approvals are marked stale", specAfter.gate === "stale" && planAfter.gate === "stale", `spec=${specAfter.gate} plan=${planAfter.gate}`);
check("R3 staleness is explained in the trail", specAfter.history.some((a) => /marked stale/.test(a)), specAfter.history.slice(-2).join(" | "));
check("R4 a stale upstream blocks the stage below it", await page.evaluate(async (boxIds) => {
  const s = () => window.__dsh.useBoardStore.getState();
  await s().runBox(boxIds.impl);
  return s().boxData[boxIds.impl].status === "error" && /not approved/i.test(s().boxData[boxIds.impl].error || "");
}, ids));

// ---- review: findings parsed, blocking blocks the merge ----
await page.evaluate(async (boxIds) => { const s = () => window.__dsh.useBoardStore.getState(); await s().approveArtifact(boxIds.intent); await s().runBox(boxIds.spec); await s().approveArtifact(boxIds.spec); await s().runBox(boxIds.plan); await s().approveArtifact(boxIds.plan); await s().runBox(boxIds.impl); await s().approveArtifact(boxIds.impl); await s().runBox(boxIds.review); }, ids);
const reviewState = await stage(ids.review);
check("V1 review ran and findings were parsed by the app", reviewState.findings.length === 2 && reviewState.findings.includes("blocking:false"), JSON.stringify(reviewState.findings));

await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().approveArtifact(boxId), ids.review);
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), ids.merge);
let mergeState = await stage(ids.merge);
check("V2 merge is blocked while a blocking finding is open", mergeState.status === "error" && /blocking finding/i.test(mergeState.error), mergeState.error.slice(0, 80));

// ---- UI: the gate panel renders and reacts ----
await page.waitForTimeout(600);
const panelText = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll(".box-node")];
  const review = nodes.find((n) => n.innerText.includes("5 · Review"));
  return review ? review.innerText : "";
});
check("V3 gate panel renders the state, the parsed finding and its severity", /Approved/.test(panelText) && /No rate limit/.test(panelText) && /blocking/i.test(panelText) && /1 blocking/.test(panelText), panelText.slice(0, 160).replace(/\n/g, " / "));
check("V4 the panel offers Approve / Request changes / Reject / Edit", ["Approve", "Request changes", "Reject", "Edit"].every((t) => panelText.includes(t)));

// dismiss the blocking finding through the UI (real click)
const dismissed = await page.evaluate(async () => {
  const nodes = [...document.querySelectorAll(".box-node")];
  const review = nodes.find((n) => n.innerText.includes("5 · Review"));
  const btn = [...review.querySelectorAll("button")].find((b) => b.textContent.trim() === "Dismiss");
  if (!btn) return false;
  btn.click();
  await new Promise((r) => setTimeout(r, 300));
  const d = window.__dsh.useBoardStore.getState();
  const boxId = Object.keys(d.boxData).find((k) => (d.boxData[k].sdlcFindings || []).length > 0);
  return (d.boxData[boxId].sdlcFindings || []).some((f) => f.severity === "blocking" && f.dismissed);
});
check("V5 dismissing a blocking finding through the UI unlocks the merge", dismissed);

// ---- downloads ----
const downloadDir = "/tmp/sdlc-downloads";
await page.evaluate(() => window.__dsh.useBoardStore.getState().approveArtifact(
  Object.keys(window.__dsh.useBoardStore.getState().boxData).find((k) => window.__dsh.useBoardStore.getState().boxData[k].sdlcFindings?.length > 0)
));
await page.evaluate((boxId) => window.__dsh.useBoardStore.getState().runBox(boxId), ids.merge);
mergeState = await stage(ids.merge);
check("D1 merge runs once the blocker is dismissed and review is approved", mergeState.status === "done" && mergeState.output.startsWith("# Merge record"), mergeState.error);

const [saveDl] = await Promise.all([
  page.waitForEvent("download"),
  page.evaluate(async () => {
    const nodes = [...document.querySelectorAll(".box-node")];
    const intent = nodes.find((n) => n.innerText.includes("1 · Intent"));
    const btn = [...intent.querySelectorAll("button")].find((b) => b.textContent.trim() === "💾 Save");
    if (!btn) throw new Error("no Save button on the intent box");
    btn.click();
  }),
]);
check("D2 💾 Save downloads the box's outcome as intent.md", saveDl.suggestedFilename() === "intent.md", saveDl.suggestedFilename());
const saved = await saveDl.path();
const savedText = saved ? await (await import("node:fs/promises")).readFile(saved, "utf8") : "";
check("D3 the saved file is the artifact itself", savedText.includes("# Add SSO to the admin console"), savedText.slice(0, 40));

const [auditDl] = await Promise.all([
  page.waitForEvent("download"),
  page.evaluate(async () => {
    const nodes = [...document.querySelectorAll(".box-node")];
    const review = nodes.find((n) => n.innerText.includes("5 · Review"));
    const btn = [...review.querySelectorAll("button")].find((b) => b.textContent.trim().includes("Audit"));
    if (!btn) throw new Error("no Audit button");
    btn.click();
  }),
]);
const auditText = await (await import("node:fs/promises")).readFile(await auditDl.path(), "utf8");
check("D4 🗂 Audit downloads the whole chain", auditDl.suggestedFilename().startsWith("sdlc-audit-"), auditDl.suggestedFilename());
check("D5 audit doc has every stage, an approval, the findings and a JSON appendix",
  /## 1 · Intent/.test(auditText) && /## 6 · Merge/.test(auditText) && /Approved by Smoke Tester/.test(auditText) && /No rate limit/.test(auditText) && /## Machine-readable record/.test(auditText),
  auditText.length + " chars");

// ---- persistence: reload keeps versions and gates ----
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__dsh.useAuthStore.setState({
  user: { uid: "smoke-uid", email: "smoke@test.local", displayName: "Smoke Tester", photoURL: "" }, loading: false,
}));
await page.waitForTimeout(1200);
const afterReload = await page.evaluate(() => {
  const d = window.__dsh.useBoardStore.getState().boxData;
  const intent = Object.values(d).find((b) => (b.sdlcVersions || []).length > 1 && b.sdlcHistory);
  return {
    boxes: Object.values(d).filter((b) => (b.sdlcVersions || []).length > 0).length,
    intents: intent ? intent.sdlcVersions.length : 0,
    merged: Object.values(d).some((b) => (b.output || "").startsWith("# Merge record")),
    approvedStages: Object.values(d).filter((b) => b.sdlcGate === "approved").length,
  };
});
check("P5 versions and gates survive a reload", afterReload.boxes === 6 && afterReload.intents === 2 && afterReload.merged && afterReload.approvedStages >= 1, JSON.stringify(afterReload));

// ---- View filter ----
const filtered = await page.evaluate(async () => {
  const sel = document.querySelector("select");
  sel.value = "sdlc";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const label = (b) => (b.querySelector("span:last-child")?.textContent || "").trim();
  const rows = [...document.querySelectorAll("button.palette-row")].map(label);
  return { rows, stored: localStorage.getItem("ai-canva:sidebar-role") };
});
check("F1 SDLC view profile filters the palette to the stages (+ shared scaffolding)",
  filtered.rows.filter((r) => /^\d+ · /.test(r)).length === 6 && !filtered.rows.some((r) => /Cartoon|Stitch UI/.test(r)),
  filtered.rows.join(" | ").slice(0, 120));
check("F2 the profile persists", filtered.stored === "sdlc");

const realErrors = pageErrors.filter((e) => !/Missing or insufficient permissions/i.test(e));
check("Z1 no unexpected page errors", realErrors.length === 0, realErrors.join(" | ").slice(0, 200));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("failed: " + failed.map((f) => f.name).join(", "));
  process.exit(1);
}
