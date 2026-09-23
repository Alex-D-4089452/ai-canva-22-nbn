/**
 * One-time migration of boards from the old Firebase project (carbondocs)
 * into the current project (ai-canva-22-nbn-fee4b).
 *
 * Uses a secondary Firebase app so the signed-in session for the new project
 * is untouched: Google sign-in happens against carbondocs only, we read that
 * project's `boards` collection, then write copies into the current project
 * owned by the *current* user (UIDs differ per project).
 */
import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { saveBoard, loadBoard, type BoardDoc } from "./firestore.js";
import { useAuthStore } from "../store/authStore.js";

/** Web config of the legacy project — kept only for this migration path. */
const CARBONDOCS_CONFIG = {
  apiKey: "AIzaSyAxrnXWRqwvmT2i3eRM60ZkUlxJoDOYAVI",
  authDomain: "carbondocs.firebaseapp.com",
  projectId: "carbondocs",
  storageBucket: "carbondocs.firebasestorage.app",
  messagingSenderId: "204832558744",
  appId: "1:204832558744:web:38a6b5d7887160fdc64aed",
};

export interface MigrationResult {
  migrated: number;
  skipped: number;
  shared: number;
  errors: string[];
}

function carbonApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === "carbondocs");
  return existing ?? initializeApp(CARBONDOCS_CONFIG, "carbondocs");
}

async function fetchOwned(db: ReturnType<typeof getFirestore>, uid: string) {
  const snap = await getDocs(
    query(collection(db, "boards"), where("ownerId", "==", uid), limit(50))
  );
  return snap.docs;
}

async function fetchShared(db: ReturnType<typeof getFirestore>, email: string) {
  if (!email) return [];
  const snap = await getDocs(
    query(
      collection(db, "boards"),
      where("collaborators", "array-contains", email),
      limit(50)
    )
  );
  return snap.docs;
}

/**
 * Sign into carbondocs with Google, pull boards owned by / shared with that
 * account, and copy them into the current project. Safe to re-run: ids that
 * already exist in the destination are skipped.
 */
export async function migrateBoardsFromCarbondocs(): Promise<MigrationResult> {
  const current = useAuthStore.getState().user;
  if (!current) {
    throw new Error("Sign in to the new project first, then run migration.");
  }

  const app = carbonApp();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  let cred;
  try {
    cred = await signInWithPopup(auth, provider);
  } catch (err: any) {
    throw new Error(
      "Google sign-in to carbondocs failed: " +
        (err?.message || "popup closed") +
        " — use the same Google account that owned the old boards."
    );
  }

  const result: MigrationResult = { migrated: 0, skipped: 0, shared: 0, errors: [] };
  try {
    const db = getFirestore(app);
    const oldUid = cred.user.uid;
    const oldEmail = cred.user.email || "";

    const [owned, shared] = await Promise.all([
      fetchOwned(db, oldUid),
      fetchShared(db, oldEmail),
    ]);

    const seen = new Set<string>();
    const docs = [...owned, ...shared].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    for (const docSnap of docs) {
      const data = docSnap.data() as Record<string, any>;
      const id = docSnap.id;
      try {
        const existing = await loadBoard(id);
        if (existing) {
          result.skipped += 1;
          continue;
        }
        const wasShared = Array.isArray(data.collaborators) && data.collaborators.length > 0;
        const board: BoardDoc = {
          id,
          title: data.title || "Untitled",
          // Destination ownership = the user signed into the NEW project.
          ownerId: current.uid,
          ownerEmail: current.email || oldEmail,
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
        await saveBoard(board);
        result.migrated += 1;
        if (wasShared && !owned.some((d) => d.id === id)) result.shared += 1;
      } catch (err: any) {
        result.errors.push(`${id}: ${err?.message || err}`);
      }
    }
  } finally {
    // Sign out of the secondary app only — primary session is separate.
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    try {
      await deleteApp(app);
    } catch {
      /* ignore */
    }
  }
  return result;
}

/** Downloads the given boards as a JSON file (manual backup / transfer). */
export function exportBoardsJson(boards: BoardDoc[]): void {
  const blob = new Blob([JSON.stringify({ boards }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-canva-boards-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Reads a previously exported boards JSON file. */
export async function parseBoardsExport(file: File): Promise<BoardDoc[]> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { boards?: BoardDoc[] } | BoardDoc[];
  const boards = Array.isArray(parsed) ? parsed : parsed.boards || [];
  if (!Array.isArray(boards)) throw new Error("Not a boards export file");
  return boards;
}

/**
 * Writes imported boards into the current project (owned by the signed-in
 * user). Existing ids are skipped. Returns how many were written.
 */
export async function importBoards(
  boards: BoardDoc[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const current = useAuthStore.getState().user;
  if (!current) throw new Error("Sign in first");
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const b of boards) {
    if (!b || typeof b.id !== "string" || !b.id) {
      errors.push("entry missing id");
      continue;
    }
    try {
      const existing = await loadBoard(b.id);
      if (existing) {
        skipped += 1;
        continue;
      }
      await saveBoard({
        ...b,
        ownerId: current.uid,
        ownerEmail: current.email || b.ownerEmail || "",
        collaborators: b.collaborators || [],
        nodes: b.nodes || [],
        edges: b.edges || [],
        boxData: b.boxData || {},
        createdAt: b.createdAt || Date.now(),
        updatedAt: b.updatedAt || Date.now(),
      });
      imported += 1;
    } catch (err: any) {
      errors.push(`${b.id}: ${err?.message || err}`);
    }
  }
  return { imported, skipped, errors };
}
