# AI Canva — Individual Capstone Project Brief

## "One Student, One Box"

> **Course:** AI-Assisted Software Project
> **Project:** Design, research, and build your own AI workflow "box" for AI Canva
> **Mode:** Individual (each student owns exactly ONE box/workflow)
> **Weighting:** Research 70% · Build 30%

---

## 1. Overview

AI Canva is a visual whiteboard where users place **boxes** (Idea, Research, PRD, Code, Slides…) on a canvas, connect them, and let AI content flow from box to box to turn an idea into a working prototype.

Your task is to design and build **one new box/workflow of your own** — a self-contained AI workflow that does something useful — and to research and justify **why it exists**.

You will build your box **using AI assistance**, so the build itself is achievable by one person. The real heart of the project is the **research**: what problem your box solves, why your design choices are the right ones, what alternatives you considered, and what the ethical/social implications are.

At the end, every student's box connects into a shared **"mega-pipeline"** — the class assembles everyone's boxes into one giant flow.

---

## 2. What you'll build (and how it plugs in)

Each box connects to the AI Canva scaffold through **three touchpoints** you control:

| # | Touchpoint | What it is | What you do |
|---|-----------|-----------|-------------|
| 1 | `types.ts` entry | The box's "identity card" | Add a `BoxType` + a `BOX_TYPES` entry: label, icon, color, category, default prompt, default system prompt |
| 2 | `runBox` branch | The orchestrator in `boardStore.ts` | Add a branch that gathers connected inputs, calls the AI backend, and post-processes the result |
| 3 | Prompt template | Your prompt-engineering | Write a `defaultPrompt` using the shared variables (`{{inputs}}`, `{{input_1}}`, `{{Box Name}}`) |

**Optional extras:** a custom render in `BoxNode.tsx` (e.g. score bars, cards, a warning banner) and/or a backend endpoint if your box needs a non-text provider.

### Demo
Deliver a **working box + a small sample pipeline** (e.g. `Idea → [your box] → Summarise`) that shows it: (1) reads inputs correctly, (2) produces a useful, well-formed output, and (3) composes with other boxes.

---

## 3. Choose your box

Pick **one** box from the menu below. Each has a distinctive research question — this is the question you'll investigate and answer in your written report.

| # | Box | What it does | Your research question |
|---|-----|--------------|------------------------|
| 🛡️ | **Policy Guardian** | Audits content against a policy; returns red/amber/green risk report | Is prompt-based AI moderation effective, or security theater? |
| 🧪 | **Idea Vetter** | Scores an idea on desirability/feasibility/viability + top risks | Can an LLM genuinely evaluate novelty and market fit? |
| 🧬 | **Persona Forge** | Turns an idea/PRD into user personas | Do AI personas help decisions, or encode stereotypes? |
| 🧭 | **Learning Path Builder** | Produces a personalized curriculum with exercises & quiz | What does an LLM get right and wrong about pedagogy? |
| 🩺 | **Symptom Triage** | Gives non-diagnostic triage with red flags & disclaimers | Should a general LLM ever be used for health triage? |
| ♿ | **Accessibility Auditor** | Audits UI code against WCAG | Can an LLM reliably audit accessibility? |
| 🌱 | **Carbon Estimator** | Estimates a system's environmental footprint | Is an LLM estimating its own carbon meaningful, or greenwashing? |
| 🎮 | **Game Design Doc** | Turns a game concept into a design document | Can an LLM reason about "fun"? |
| 📈 | **Data Storyteller** | Turns raw data into a narrative + charts | Can an LLM actually analyze data, or just narrate it? |
| 🧠 | **Cognitive Bias Checker** | Flags cognitive biases + counter-questions | Does naming a bias actually change a decision? |
| 🗣️ | **Plain Language Translator** | Rewrites jargon into plain language at a target level | Does simplifying lose meaning? |
| 🔐 | **Privacy Redactor** | Redacts PII from text with a reversible map | Is LLM redaction trustworthy vs deterministic tools? |

> **Note:** You may also propose your own box idea — but it must include a strong research question and be approved by your instructor first.

---

## 4. Deliverables

### A. Working box (30%)
- [ ] `types.ts` entry for your box
- [ ] `runBox` branch that reads inputs and produces output
- [ ] A prompt template using `{{inputs}}` / `{{input_1}}` / `{{Box Name}}`
- [ ] A working demo pipeline (your box connected to at least one upstream + one downstream box)
- [ ] Clean code — readable, commented, small

### B. Written research report (70%)
A written document (e.g. 2,000–2,500 words) structured as:

1. **Problem & motivation** — what problem does your box solve, for whom, and why does it matter?
2. **Domain context** — the background research that frames the problem (cite sources).
3. **Design rationale** — why your prompt structure, output format, and provider choices are correct.
4. **Alternatives** — what other approaches exist (human, deterministic, other models) and why you chose yours.
5. **Ethical & social considerations** — harms, limits, bias, and the guardrails your box needs.
6. **Answer to the research question** — your evidence-based conclusion.

### C. Reflection / demo (30%)
- A 5-minute live demo of your box in a pipeline, plus
- A short reflection: what you learned, what the AI got right/wrong, and what you'd change.

---

## 5. Milestones

| Milestone | Due | Deliverable |
|-----------|-----|-------------|
| **M1 — Research plan** | Week 2 | Box choice + research question + 3 sources |
| **M2 — Scaffold** | Week 4 | Box registered in `types.ts` + prompt draft |
| **M3 — Working build** | Week 6 | `runBox` branch working + demo pipeline |
| **M4 — Research report** | Week 8 | Full written report |
| **M5 — Demo & mega-pipeline** | Week 10 | Live demo + class pipeline assembled |

---

## 6. Rubric

### Build (30%)

| Criteria | Excellent | Good | Needs work |
|----------|-----------|------|------------|
| **Functionality** (15%) | Box runs, reads inputs, produces a well-formed output | Works but output needs manual fixes | Output broken or often empty |
| **Scaffold integration** (10%) | Correctly wired into all 3 touchpoints + clean code | Wired but minor issues | Touchpoints incomplete |
| **Demo** (5%) | Live demo composes with other boxes | Demo works | Demo fails or none |

### Research (70%)

| Criteria | Excellent | Good | Needs work |
|----------|-----------|------|------------|
| **Problem & motivation** (15%) | Precise problem, clearly argued importance | Problem stated, general importance | Problem vague |
| **Research & sources** (15%) | Deep, current, well-cited | Solid sources, good synthesis | Few sources, shallow |
| **Design rationale** (15%) | Justified choices with real reasoning | Reasonable rationale | Choices unstated |
| **Alternatives & trade-offs** (10%) | Strong comparison of approaches | Some alternatives compared | Little/no comparison |
| **Ethics & limits** (10%) | Recognizes AI limits, proposes guardrails | Mentions limits | Ignores risks |
| **Research question answered** (5%) | Clear, evidence-based conclusion | Conclusion present | Conclusion weak |

---

## 7. Guidelines

- **Use AI to build** — that's the point. But you must be able to explain every part of your box.
- **Don't over-engineer** — a working, well-researched simple box beats a broken complex one.
- **Cite everything** — reference the research your justify with.
- **Be honest about limits** — the best projects acknowledge what the AI can't do, not just what it can.

---

## 8. Good luck

Your box will become part of a shared class "mega-pipeline" — every student's contribution combines into one giant flow from idea to prototype. The quality of your research is what makes your box a genuine contribution. Go explore. Go build. Go justify.
