import { auth, googleProvider } from "./firebase.js";
import { API_BASE } from "./api.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Joins a workshop with a seat code. The join endpoint (Cloud Function)
 * redeems the code for a durable Firebase custom token: first use binds the
 * code to a new guest uid, later uses return a token for the SAME uid so the
 * guest keeps their identity and boards on any device. Signs in and returns
 * the team/workshop info for the post-join flow.
 */
export async function signInWithWorkshopCode(
  code: string
): Promise<{
  isNew: boolean;
  teamId: string;
  workshopId: string;
  teamName: string;
  workshopName: string;
  boardId: string;
}> {
  const { signInWithCustomToken } = await import("firebase/auth");
  const res = await fetch(`${API_BASE}/workshop/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to join workshop");
  await signInWithCustomToken(auth, data.token as string);
  return {
    isNew: !!data.isNew,
    teamId: data.teamId || "",
    workshopId: data.workshopId || "",
    teamName: data.teamName || "",
    workshopName: data.workshopName || "",
    boardId: data.boardId || "",
  };
}

// --- E2E test helpers (unused by the app UI, so tree-shaken from prod) ---
// The E2E suite (client/e2e.mjs) imports this module from the Vite dev server
// and signs in with email/password — the prod UI only offers Google. Requires
// the Email/Password provider to be enabled in Firebase Auth (see AGENTS.md
// "E2E suite"). Test accounts are created/removed by the suite itself.

export async function createTestAccount(email: string, password: string): Promise<User> {
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInTestAccount(email: string, password: string): Promise<User> {
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}