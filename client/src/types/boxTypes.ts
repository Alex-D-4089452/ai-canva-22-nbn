import type { BoxType, BoxTypeMeta } from "./core.js";
import { ideaBox } from "./boxes/idea.js";
import { agentBox } from "./boxes/agent.js";
import { researchBox } from "./boxes/research.js";
import { summariseBox } from "./boxes/summarise.js";
import { imageBox } from "./boxes/image.js";
import { documentsBox } from "./boxes/documents.js";
import { cartoonBox } from "./boxes/cartoon.js";
import { slidesBox } from "./boxes/slides.js";
import { prdBox } from "./boxes/prd.js";
import { uiBox } from "./boxes/ui.js";
import { stitchBox } from "./boxes/stitch.js";
import { handoffBox } from "./boxes/handoff.js";
import { alignmentBox } from "./boxes/alignment.js";
import { decisionBox } from "./boxes/decision.js";
import { noteBox } from "./boxes/note.js";
import { labelBox } from "./boxes/label.js";
import { timerBox } from "./boxes/timer.js";
import { checklistBox } from "./boxes/checklist.js";
import { customBox } from "./boxes/custom.js";

/**
 * Metadata for every box type, keyed by its BoxType name. The
 * `Record<BoxType, BoxTypeMeta>` keeps the union (core.ts) and this table in
 * lockstep: a union member with no entry here — or an entry that is not in the
 * union — is a compile error. Insertion order is the palette order.
 */
export const BOX_TYPES: Record<BoxType, BoxTypeMeta> = {
  idea: ideaBox,
  agent: agentBox,
  research: researchBox,
  summarise: summariseBox,
  image: imageBox,
  documents: documentsBox,
  cartoon: cartoonBox,
  slides: slidesBox,
  prd: prdBox,
  ui: uiBox,
  stitch: stitchBox,
  handoff: handoffBox,
  alignment: alignmentBox,
  decision: decisionBox,
  note: noteBox,
  label: labelBox,
  timer: timerBox,
  checklist: checklistBox,
  custom: customBox,
};
