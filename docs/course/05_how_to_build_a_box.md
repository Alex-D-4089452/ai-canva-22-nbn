# How to Create a Simple Box — Step-by-Step Guide (for beginners)

> **Project:** AI Canva · **Course:** One Student, One Box
> **Assumes:** You can already run the app (`npm run dev`), and you've read the README.
> **This guide teaches you, in plain words, exactly how to add your own box — by building a real, working example: the "SWOT Box".**

---

## What you'll learn

By the end, you will have added a brand-new box called **SWOT Box** that takes any text (like an idea) and asks the AI to produce a SWOT analysis (Strengths, Weaknesses, Opportunities, Threats). You'll also learn the **rules** for keeping your code clean and sharing it without breaking everyone else's.

A box is made of **three small pieces** of code. If you add all three, your box appears in the sidebar and works. Here they are:

| # | File | What it does |
|---|------|--------------|
| 1 | `client/src/types.ts` | Tells AI Canva your box exists (its name, icon, colour, and default prompt) |
| 2 | `client/src/store/boardStore.ts` | Tells AI Canva **what to do when the user presses Run** on your box |
| 3 | (optional) `client/src/components/BoxNode.tsx` | Tells AI Canva **how to draw** your box's output nicely |

> **Golden rule:** a *text* box needs only files #1 and #2. Most student boxes are text boxes. File #3 is only needed if you want fancy visuals (like a slides viewer or score bars).

---

## PART 1 — The three touchpoints (what code to write)

### Touchpoint 1: Register your box in `types.ts`

Open `client/src/types.ts`. Scroll to the top. You'll see a line listing every box type:

```ts
export type BoxType = "idea" | "research" | "summarise" | "image" | ...;
```

**Add your box name** to that list (add it at the end):

```ts
export type BoxType = "idea" | "agent" | "research" | "summarise" | "image" | "documents" | "cartoon" | "slides" | "prd" | "ui" | "stitch" | "handoff" | "alignment" | "decision" | "note" | "label" | "timer" | "checklist" | "custom" | "swot";
```

Now scroll down to the big `BOX_TYPES` object. **Each box has an entry that describes it.** After the last entry (`custom: {...}`), add a comma and your own entry:

```ts
swot: {
  label: "SWOT",                 // the name shown in the sidebar
  icon: "⚖️",                    // the icon shown
  color: "#f59e0b",             // a colour (amber here)
  description: "Analyse any idea and produce a SWOT (Strengths, Weaknesses, Opportunities, Threats).",
  hasAI: true,                   // true = it calls the AI when you press Run
  category: "worker",            // "worker" = it processes input (vs "input" = just text you type)
  defaultPrompt:
    "Turn the following into a SWOT analysis. Use four sections — Strengths, Weaknesses, Opportunities, Threats — as bullet points under each.\n\nIdea:\n{{input_1}}",
  defaultSystemPrompt:
    "You are a business analyst. Produce a clear, balanced SWOT analysis in Markdown. Be specific and honest about weaknesses.",
  defaultWidth: 320,             // starting box width
  defaultHeight: 320,            // starting box height
},
```

> **Stop and check:** your box is now *registered*. If you save and refresh the app, **"SWOT" appears in the sidebar** with a ⚡ icon. Clicking it drops a SWOT box on the canvas. But pressing Run does nothing yet — that's the next step.

**Why this matters for your research:** the `defaultPrompt` and `defaultSystemPrompt` are where your *prompt-engineering* lives — the heart of your project's research. Choosing a good prompt is a design decision you'll defend in your report.

---

### Step 2: Make it run — add the `runBox` branch in `boardStore.ts`

Open `client/src/store/boardStore.ts`. Scroll down until you find the function called `runBox`. It's the big one with the line `runBox: async (id) => {`. Inside, there's a chain of `if (boxType === "...")` checks:

```ts
if (boxType === "cartoon") { ... }
else if (boxType === "stitch") { ... }
else {
  // this handles research, summarise, slides, prd, etc.
}
```

For a simple *text* box, you want to use the existing "else" text path — you don't need to write a whole new branch. **But** you still need to tell it how to handle your output. Add your box to the final `else` block's logic.

Actually, the simplest approach: since a SWOT box just produces text (like research/summarise), you don't add a new branch at all — your box falls into the generic text path automatically and stores its output. **But** to make sure your box is recognised and to give you a place to add custom post-processing later, add one `else if` line *before* the `slides` check:

```ts
} else if (boxType === "swot") {
  // SWOT is just text output — the AI already formatted it as Markdown.
  get().updateBoxData(id, {
    output: result.content,
    status: "done",
    error: undefined,
  });
} else if (boxType === "slides") {
```

> **What this does:** when the user clicks **Run** on your SWOT box, AI Canva:
> 1. collects the connected inputs (via `fillPromptTemplate`),
> 2. calls the AI backend with your `defaultPrompt` + `defaultSystemPrompt`,
> 3. runs this `else if` branch, which saves the AI's reply as the box's `output` and marks it `done`.

**No new backend code is needed** — your box reuses the existing `/api/generate` (Ollama) endpoint that Research/Summarise already use.

---

### Step 3 (optional): Custom rendering in `BoxNode.tsx`

If you want to *draw* your output nicely (e.g. colour-coded SWOT sections instead of plain text), open `client/src/components/BoxNode.tsx` and add a render case. This is optional — plain Markdown text already renders. Only add this if your box produces *structured* output (JSON) you want to visualise.

> **Start simple.** Build a plain-text SWOT box first. Make it work. *Then* decide if it needs fancy rendering for your demo.

---

## PART 2 — Testing your box

1. **Run the app** (`npm run dev`) — client on `localhost:5173`.
2. **Add a SWOT box** from the sidebar.
3. **Add an Idea box**, type an idea in it.
4. **Connect them:** drag from the Idea box's right `●` to the SWOT box's left `●`.
5. **Press Run** on the SWOT box.
6. You should see a SWOT analysis appear.

If it shows an error, look at the box's red error banner — it tells you what went wrong (common: no `OLLAMA_API_KEY`, no input connected, or the AI returned something empty).

---

## PART 3 — Rules for branching, code management & working together

Because everyone is adding boxes to the *same* codebase, you MUST follow these rules. They stop you from breaking each other's work.

### A. Branching rules (always work on your own branch)

You should NEVER write code directly on `main`. Use a branch named after your box.

```
# 1. Make sure you're starting from the latest code
git checkout main
git pull

# 2. Create a branch named after your box
git checkout -b feature/swot-box

# 3. Do all your work here
# ... edit types.ts, boardStore.ts, etc. ...

# 4. Save (commit) your work with a clear message
git add client/src/types.ts client/src/store/boardStore.ts
git commit -m "Add SWOT box: types entry + runBox branch"
```

**Naming convention for branches:** `feature/<box-name>`. Examples: `feature/swot-box`, `feature/idea-vetter`, `feature/privacy-redactor`. Never `fix`, `stuff`, or `asdf`.

### B. Commit rules (commit often, small, and clearly)

- **Commit small chunks** — one logical change per commit. Don't cram 5 features into one commit.
- **Write a clear message:** `Add SWOT box: types entry`, `Fix: SWOT now handles empty input`.
- **Commit only the files you meant to change.** Before committing, check `git status` to see what's staged.
- **Do NOT commit secrets.** Never commit `.env` files, API keys, or passwords. Your keys stay in a local `.env` (which is git-ignored).

### C. The Pull Request (PR) flow — how your box gets into the class project

1. After you commit, **push your branch**:
   ```
   git push origin <your-branch-name>
   ```
2. Open a **Pull Request** from your branch into `main`.
3. **Someone reviews it** (your instructor or a classmate). They check: does it run? is it clean? any errors?
4. After review approval, it gets **merged** into `main`.

> **Rule:** never merge your own PR without a review. Reviewing is part of the learning.

### D. The "never break main" rule

- **Always `pull` before you start** to get the latest code.
- **Test your box before you push.** If your code has a syntax error, it can break the whole app.
- **Keep your changes small** and only touch the files you need. If you see yourself editing a file you don't understand, stop and ask.

### E. Code style & cleanliness

- **TypeScript, not plain JS** — the project uses `.ts` files. Use types.
- **Format before commit** — the project uses Prettier. Run `npm run format` (or your editor's format) before committing.
- **Comments:** explain the *why*, not the *what*. A comment like `// verify the code can render` is good; `// this adds a box` is pointless.
- **Name things clearly:** `swot`, `swotPrompt`, `defaultSystemPrompt` — not `x`, `foo`, `temp`.

---

## PART 4 — A minimal "cheat sheet" for your box

| Task | File | What you write |
|------|------|----------------|
| Add box to the type list | `types.ts` | `"swot"` to the `BoxType` union |
| Describe your box | `types.ts` | a `swot: {...}` entry in `BOX_TYPES` |
| Make Run work | `boardStore.ts` | an `else if (boxType === "swot")` in `runBox` |
| Custom output UI (optional) | `BoxNode.tsx` | a rendering branch |

**The two files you MUST touch to make a text box:** `types.ts` and `boardStore.ts`. Everything else is optional.

---

## PART 5 — Common problems & fixes

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Box doesn't appear in sidebar | `BoxType` union not updated OR typo in `BOX_TYPES` | Check `types.ts` — add to both places |
| Run does nothing / error | Missing `OLLAMA_API_KEY` in server `.env` | Put your key in `server/.env` |
| Output is empty | Box ran with no inputs, or prompt variable wrong | Connect an Idea box; check `{{input_1}}` |
| "syntax error" | You broke a line in a file | Check your edits; run `npm run build` to catch it |
| Can't push | Not on a branch / not committed | `git branch`, commit, then push |

---

## PART 6 — What counts for your research

Your box *build* is only 30% of the grade. The **research (70%)** is in the choices you made:
- **Why did you choose the SWOT box** — what problem does it solve, for whom?
- **Why did you design the prompt this way** — why SWOT, why those instructions, what alternatives (different prompt, no AI at all, a different model)?
- **What are the AI's limits here?** — does the AI's SWOT actually make sense, or is it generic?
- **Ethics** — could a SWOT box be used misleadingly (e.g. to "prove" an idea is great)?

Keep these in mind *while you build* — the build informs the research.

---

> **You're ready.** Follow Part 1 to add your first box, use Part 3 for branch/pr/clean-code rules, and test with Part 2. When it works, write your research around the choices in Part 6.
