import { db } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  updateDoc,
  addDoc,
  increment,
  setDoc as setDocPresence,
} from "firebase/firestore";
import type { PresenceUser } from "../types/index.js";
import type { CustomBoxDef } from "./customBoxes.js";

export interface BoardDoc {
  id: string;
  title: string;
  ownerId: string;
  ownerEmail: string;
  collaborators: string[];
  /** Facilitator template boards — excluded from the regular board list. */
  isTemplate?: boolean;
  /** Set on team boards created from a template (back-reference). */
  teamId?: string;
  /** Guest (code-based) members with access, by uid — team boards. */
  memberUids?: string[];
  nodes: unknown[];
  edges: unknown[];
  boxData: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

const BOARDS_COLLECTION = "boards";

function parseBoard(id: string, data: Record<string, any>): BoardDoc {
  return {
    id,
    title: data.title || "Untitled",
    ownerId: data.ownerId || "",
    ownerEmail: data.ownerEmail || "",
    collaborators: data.collaborators || [],
    isTemplate: data.isTemplate || false,
    teamId: data.teamId || "",
    memberUids: data.memberUids || [],
    nodes: data.nodes || [],
    edges: data.edges || [],
    boxData: data.boxData || {},
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

/** Saves a board to Firestore (creates or overwrites). */
export async function saveBoard(board: BoardDoc): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, board.id);
  await setDoc(
    ref,
    {
      title: board.title,
      ownerId: board.ownerId,
      ownerEmail: board.ownerEmail,
      collaborators: board.collaborators || [],
      nodes: board.nodes,
      edges: board.edges,
      boxData: board.boxData,
      isTemplate: board.isTemplate || false,
      teamId: board.teamId || "",
      memberUids: board.memberUids || [],
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    },
    { merge: true }
  );
}

/** Loads a single board by ID. */
export async function loadBoard(boardId: string): Promise<BoardDoc | null> {
  const ref = doc(db, BOARDS_COLLECTION, boardId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return parseBoard(snap.id, snap.data() as Record<string, any>);
}

/** Lists all boards owned by a user, newest first. */
export async function listBoards(userId: string): Promise<BoardDoc[]> {
  const q = query(
    collection(db, BOARDS_COLLECTION),
    where("ownerId", "==", userId),
    limit(50)
  );
  const snap = await getDocs(q);
  const boards = snap.docs.map((d) => parseBoard(d.id, d.data() as Record<string, any>));
  return boards
    .filter((b) => !b.isTemplate) // templates are managed in the Facilitator Dashboard
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Lists a facilitator's template boards (workshop assets). */
export async function listTemplateBoards(userId: string): Promise<BoardDoc[]> {
  const q = query(
    collection(db, BOARDS_COLLECTION),
    where("ownerId", "==", userId),
    where("isTemplate", "==", true),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => parseBoard(d.id, d.data() as Record<string, any>))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Lists boards shared with a user — either by email (the classic share flow)
 * or by uid membership (workshop team boards carry memberUids for guests).
 * Either key may be empty; results are merged and deduped, newest first.
 */
export async function listSharedBoards(userEmail: string, uid?: string): Promise<BoardDoc[]> {
  const queries: Promise<BoardDoc[]>[] = [];
  if (userEmail) {
    queries.push(
      getDocs(
        query(
          collection(db, BOARDS_COLLECTION),
          where("collaborators", "array-contains", userEmail),
          limit(50)
        )
      ).then((snap) => snap.docs.map((d) => parseBoard(d.id, d.data() as Record<string, any>)))
    );
  }
  if (uid) {
    queries.push(
      getDocs(
        query(
          collection(db, BOARDS_COLLECTION),
          where("memberUids", "array-contains", uid),
          limit(50)
        )
      ).then((snap) => snap.docs.map((d) => parseBoard(d.id, d.data() as Record<string, any>)))
    );
  }
  const results = await Promise.all(queries);
  const seen = new Set<string>();
  const merged: BoardDoc[] = [];
  for (const list of results) {
    for (const b of list) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      merged.push(b);
    }
  }
  return merged.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Adds a guest as a member of a board (uid always; email when provided). */
export async function addBoardMember(
  boardId: string,
  uid: string,
  email?: string
): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, boardId);
  await updateDoc(ref, {
    memberUids: arrayUnion(uid),
    ...(email ? { collaborators: arrayUnion(email) } : {}),
  });
}

/** Deletes a board by ID. */
export async function deleteBoard(boardId: string): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, boardId);
  await deleteDoc(ref);
}

/** Updates only mutable board fields (nodes, edges, boxData, title, updatedAt).
 * Does NOT overwrite ownerId, ownerEmail, or createdAt.
 * This allows collaborators to save changes without claiming ownership.
 */
export async function updateBoardData(
  boardId: string,
  data: {
    title?: string;
    collaborators?: string[];
    nodes?: unknown[];
    edges?: unknown[];
    boxData?: Record<string, unknown>;
    updatedAt: number;
  }
): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, boardId);
  await updateDoc(ref, data as Record<string, unknown>);
}

// === Real-time subscription ===

/** Subscribes to real-time board updates. Returns an unsubscribe function. */
export function subscribeToBoard(
  boardId: string,
  callback: (board: BoardDoc) => void
): () => void {
  const ref = doc(db, BOARDS_COLLECTION, boardId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback(parseBoard(snap.id, snap.data() as Record<string, any>));
      }
    },
    (err) => console.error("[firestore] Board subscription error:", err.message)
  );
}

// === Presence (live cursors) ===

/** Subscribes to presence updates for a board. Returns an unsubscribe function. */
export function subscribeToPresence(
  boardId: string,
  callback: (users: PresenceUser[]) => void
): () => void {
  const colRef = collection(db, BOARDS_COLLECTION, boardId, "presence");
  return onSnapshot(
    colRef,
    (snap) => {
    const now = Date.now();
    const users: PresenceUser[] = [];
    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, any>;
      // Filter out stale entries (last active > 30s ago)
      if (data.lastActive && now - data.lastActive < 30000) {
        users.push({
          userId: data.userId || d.id,
          email: data.email || "",
          displayName: data.displayName || "",
          initials: data.initials || "",
          color: data.color || "#94a3b8",
          cursorX: data.cursorX ?? 0,
          cursorY: data.cursorY ?? 0,
          hasCursor: data.cursorX !== undefined,
        });
      }
    });
    callback(users);
    },
    (err) => console.error("[firestore] Presence subscription error:", err.message)
  );
}

/** Updates the current user's presence (cursor position + heartbeat). */
export async function updatePresence(
  boardId: string,
  userId: string,
  data: Partial<PresenceUser>
): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, boardId, "presence", userId);
  await setDocPresence(ref, { ...data, lastActive: Date.now() }, { merge: true });
}

/** Removes the current user's presence when they leave. */
export async function removePresence(boardId: string, userId: string): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, boardId, "presence", userId);
  try {
    await deleteDoc(ref);
  } catch {
    // ignore — might already be deleted
  }
}

// === Sharing ===

/** Adds collaborator emails to a board. */
export async function shareBoard(boardId: string, emails: string[]): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, boardId);
  await updateDoc(ref, { collaborators: arrayUnion(...emails) });
}

/** Removes a collaborator email from a board. */
export async function unshareBoard(boardId: string, email: string): Promise<void> {
  const ref = doc(db, BOARDS_COLLECTION, boardId);
  await updateDoc(ref, { collaborators: arrayRemove(email) });
}

// === Token usage ===

/**
 * Records one LLM call's token usage. Writes a detailed `tokenUsage/{autoId}`
 * doc for history/aggregation and atomically bumps the user's rolling totals
 * in `usageTotals/{uid}` (via Firestore increment, so concurrent calls don't
 * lose updates). Best-effort: failures are swallowed so a usage-write hiccup
 * never fails the user's generation.
 */
export async function recordTokenUsage(
  userId: string,
  boardId: string,
  boxId: string,
  boxType: string,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number },
  model?: string
): Promise<void> {
  try {
    await Promise.all([
      addDoc(collection(db, "tokenUsage"), {
        userId,
        boardId,
        boxId,
        boxType,
        model: model || "",
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        createdAt: new Date(),
      }),
      setDoc(
        doc(db, "usageTotals", userId),
        {
          promptTokens: increment(usage.promptTokens),
          completionTokens: increment(usage.completionTokens),
          totalTokens: increment(usage.totalTokens),
          updatedAt: new Date(),
        },
        { merge: true }
      ),
    ]);
  } catch (err) {
    console.warn("[tokenUsage] Could not record usage:", err);
  }
}

/** Returns the given user's cumulative token total (0 if never used). */
export async function fetchUserTokenTotal(userId: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "usageTotals", userId));
    if (snap.exists()) return Number(snap.data().totalTokens || 0);
    return 0;
  } catch (err) {
    console.warn("[tokenUsage] Could not fetch total:", err);
    return 0;
  }
}

// === Custom box templates (users/{uid}/boxes/{boxId}) ===

/** Lists the signed-in user's saved custom box definitions. */
export async function listUserBoxes(userId: string): Promise<CustomBoxDef[]> {
  const q = query(
    collection(db, "users", userId, "boxes"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomBoxDef, "id">) }));
}

/** Saves (creates) a custom box definition in the user's profile. */
export async function saveUserBox(
  userId: string,
  def: Omit<CustomBoxDef, "id">
): Promise<string> {
  const ref = await addDoc(collection(db, "users", userId, "boxes"), def);
  return ref.id;
}

/** Deletes a saved custom box definition (existing board boxes are unaffected). */
export async function deleteUserBox(userId: string, boxId: string): Promise<void> {
  await deleteDoc(doc(db, "users", userId, "boxes", boxId));
}

