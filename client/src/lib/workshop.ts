import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { API_BASE } from "./api.js";

const BOARDS_COLLECTION_REF = "boards";
import {
  saveBoard,
  deleteBoard,
  type BoardDoc,
} from "./firestore.js";

/** Alphabet for seat codes — no 0/O/1/I to avoid transcription mix-ups. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
/** Hard cap on people per team (one seat per code). */
export const MAX_TEAM_MEMBERS = 5;

export interface Workshop {
  id: string;
  name: string;
  description: string;
  facilitatorUid: string;
  facilitatorEmail: string;
  createdAt: number;
}

export interface Team {
  id: string;
  workshopId: string;
  workshopName: string;
  name: string;
  boardId: string;
  templateBoardId: string;
  facilitatorUid: string;
  maxMembers: number;
  createdAt: number;
}

export interface SeatCode {
  code: string;
  teamId: string;
  workshopId: string;
  uid?: string;
  guestName?: string;
  claimed?: boolean;
  claimedAt?: number;
}

export interface JoinResult {
  token: string;
  isNew: boolean;
  teamId: string;
  workshopId: string;
  teamName: string;
  workshopName: string;
  boardId: string;
}

/** Generates a random 8-char seat code (A–Z, 2–9, unambiguous). */
export function generateWorkshopCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Pure transform: builds the team board document from a template board.
 * Copies nodes/edges/boxData verbatim (ids stay stable within the new board)
 * and resets ownership/collaboration. The copy is a normal board — not a
 * template — tagged with its teamId.
 */
export function buildTeamBoard(
  template: BoardDoc,
  opts: {
    id: string;
    title: string;
    teamId: string;
    facilitatorUid: string;
    facilitatorEmail: string;
  }
): BoardDoc {
  return {
    id: opts.id,
    title: opts.title,
    ownerId: opts.facilitatorUid,
    ownerEmail: opts.facilitatorEmail,
    collaborators: [],
    memberUids: [],
    isTemplate: false,
    teamId: opts.teamId,
    nodes: template.nodes,
    edges: template.edges,
    boxData: template.boxData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Creates a fresh, empty template board owned by the facilitator. */
export async function createTemplateBoard(
  user: { uid: string; email: string },
  title: string
): Promise<string> {
  const id = `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await saveBoard({
    id,
    title: title.trim() || "Untitled Template",
    ownerId: user.uid,
    ownerEmail: user.email,
    collaborators: [],
    isTemplate: true,
    memberUids: [],
    nodes: [],
    edges: [],
    boxData: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return id;
}

/** Flags/unflags an existing board as a workshop template. */
export async function setBoardTemplate(boardId: string, isTemplate: boolean): Promise<void> {
  await updateDoc(doc(db, BOARDS_COLLECTION_REF, boardId), { isTemplate });
}

/** Creates a workshop owned by the facilitator. */
export async function createWorkshop(
  user: { uid: string; email: string },
  name: string,
  description: string
): Promise<string> {
  const ref = await addDoc(collection(db, "workshops"), {
    name: name.trim(),
    description: description.trim(),
    facilitatorUid: user.uid,
    facilitatorEmail: user.email,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function listWorkshops(facilitatorUid: string): Promise<Workshop[]> {
  const snap = await getDocs(collection(db, "workshops"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Workshop, "id">) }))
    .filter((w) => w.facilitatorUid === facilitatorUid)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteWorkshop(id: string): Promise<void> {
  await deleteDoc(doc(db, "workshops", id));
}

/**
 * Creates a team under a workshop: copies the template board, writes the
 * team doc, and generates the seat codes (MAX_TEAM_MEMBERS of them).
 * Returns the team id.
 */
export async function createTeamFromTemplate(opts: {
  workshop: Workshop;
  name: string;
  template: BoardDoc;
  facilitatorUid: string;
  facilitatorEmail: string;
  newBoardId: () => string;
}): Promise<string> {
  const teamRef = await addDoc(collection(db, "teams"), {
    workshopId: opts.workshop.id,
    workshopName: opts.workshop.name,
    name: opts.name.trim(),
    boardId: "", // filled after the board is saved
    templateBoardId: opts.template.id,
    facilitatorUid: opts.facilitatorUid,
    maxMembers: MAX_TEAM_MEMBERS,
    createdAt: Date.now(),
  });

  const board = buildTeamBoard(opts.template, {
    id: opts.newBoardId(),
    title: `${opts.workshop.name} — ${opts.name.trim()}`,
    teamId: teamRef.id,
    facilitatorUid: opts.facilitatorUid,
    facilitatorEmail: opts.facilitatorEmail,
  });
  await saveBoard(board);
  await updateDoc(teamRef, { boardId: board.id });

  // Seat codes — one per seat, created unclaimed. Top-level codes/{code}
  // docs so the join endpoint can fetch them by id (no query/index needed).
  for (let i = 0; i < MAX_TEAM_MEMBERS; i++) {
    const code = generateWorkshopCode();
    await setDoc(doc(db, "codes", code), {
      code,
      teamId: teamRef.id,
      workshopId: opts.workshop.id,
    });
  }
  return teamRef.id;
}

export async function listTeams(workshopId: string): Promise<Team[]> {
  const snap = await getDocs(query(collection(db, "teams"), orderBy("createdAt", "asc")));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Team, "id">) }))
    .filter((t) => t.workshopId === workshopId);
}

export async function listCodes(teamId: string): Promise<SeatCode[]> {
  const snap = await getDocs(query(collection(db, "codes"), where("teamId", "==", teamId)));
  return snap.docs.map((d) => d.data() as SeatCode);
}

/** Replaces an UNCLAIMED code with a fresh one. Claimed codes cannot change. */
export async function regenerateCode(
  teamId: string,
  workshopId: string,
  oldCode: string
): Promise<string> {
  const old = await getDocs(query(collection(db, "codes"), where("teamId", "==", teamId)));
  const existing = old.docs.map((d) => d.data() as SeatCode);
  const target = existing.find((c) => c.code === oldCode);
  if (target?.claimed) {
    throw new Error("This code is already in use by a guest and cannot be changed.");
  }
  let fresh = generateWorkshopCode();
  while (existing.some((c) => c.code === fresh)) fresh = generateWorkshopCode();
  await deleteDoc(doc(db, "codes", oldCode));
  await setDoc(doc(db, "codes", fresh), {
    code: fresh,
    teamId,
    workshopId,
  });
  return fresh;
}

export async function deleteTeam(team: Team): Promise<void> {
  const codes = await getDocs(query(collection(db, "codes"), where("teamId", "==", team.id)));
  const removals = codes.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(removals);
  await deleteDoc(doc(db, "teams", team.id));
  if (team.boardId) {
    await deleteBoard(team.boardId).catch(() => {});
  }
}

/** Redeems a seat code via the join endpoint (functions only; local proxies). */
export async function joinWorkshop(code: string): Promise<JoinResult> {
  const res = await fetch(`${API_BASE}/workshop/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to join workshop");
  return data as JoinResult;
}