import { db } from "./firebase.js";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { API_BASE } from "./api.js";

const USERS_COLLECTION = "users";
const ADMINS_COLLECTION = "admins";
const FACILITATORS_COLLECTION = "facilitators";

/** Whether the given UID is an admin (a doc exists at `admins/{uid}`). */
export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, ADMINS_COLLECTION, uid));
    return snap.exists();
  } catch (err) {
    console.error("[admin] isAdmin check failed:", err);
    return false;
  }
}

/** Whether the given UID is a facilitator (a doc exists at `facilitators/{uid}`). */
export async function isFacilitator(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, FACILITATORS_COLLECTION, uid));
    return snap.exists();
  } catch (err) {
    console.error("[admin] isFacilitator check failed:", err);
    return false;
  }
}

/** The profile email for a uid (guests keep their email in users/{uid}). */
export async function getUserEmail(uid: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
    return (snap.data()?.email as string) || "";
  } catch {
    return "";
  }
}

/** Grants/revokes the facilitator role (admin-only endpoint). */
export async function setFacilitatorRole(
  user: User,
  uid: string,
  grant: boolean
): Promise<void> {
  const res = await adminFetch(user, "/admin/roles", {
    method: "POST",
    body: JSON.stringify({ uid, role: "facilitator", grant }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to update role");
}

/**
 * Records/refreshes the current user's profile in the `users` collection.
 * Preserves the original `createdAt` across re-logins (only set on first sight).
 */
export async function updateUserProfile(user: User): Promise<void> {
  const ref = doc(db, USERS_COLLECTION, user.uid);
  const existing = await getDoc(ref);
  const now = Date.now();
  await setDoc(
    ref,
    {
      email: user.email || "",
      displayName: user.displayName || user.email || "",
      photoURL: user.photoURL || "",
      // Only set createdAt on first creation so re-logins don't reset it.
      createdAt: existing.exists() ? existing.data()?.createdAt ?? now : now,
      lastActive: now,
    },
    { merge: true }
  );
}

/** Updates the user's `lastActive` heartbeat (used for "active now" stats). */
export async function heartbeat(user: User): Promise<void> {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
      lastActive: Date.now(),
    });
  } catch (err) {
    // Best-effort — ignore transient failures.
    console.error("[admin] heartbeat failed:", err);
  }
}

export interface AdminStats {
  generatedAt: number;
  users: { total: number; activeLast5m: number; newLast7d: number };
  boards: { total: number; newLast7d: number };
  storage: { bytes: number; files: number };
  tokens: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  disabled: boolean;
  facilitator: boolean;
  createdAt: string | null;
  lastSignIn: string | null;
  /** Per-user token usage: promptTokens = up (input), completionTokens = down (output). */
  tokens: { promptTokens: number; completionTokens: number; totalTokens: number };
}

async function adminFetch(user: User, path: string, init?: RequestInit): Promise<Response> {
  const token = await user.getIdToken();
  return fetch(path.startsWith("http") ? path : `${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
}

async function handleAdminResponse(res: Response): Promise<any> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches system-wide admin stats from the backend.
 * Requires the caller to be an admin; the backend verifies the ID token.
 */
export async function fetchAdminStats(user: User): Promise<AdminStats> {
  const res = await adminFetch(user, "/admin/stats");
  return handleAdminResponse(res);
}

/**
 * Fetches a page of registered users from Firebase Auth.
 * Pass `pageToken` (from a prior response) to get the next page.
 */
export async function fetchUsers(
  user: User,
  pageToken?: string
): Promise<{ users: AdminUser[]; nextPageToken: string | null }> {
  const q = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
  const res = await adminFetch(user, `/admin/users${q}`);
  return handleAdminResponse(res);
}

/** Blocks (disabled: true) or unblocks (disabled: false) a user's account. */
export async function setUserBlocked(
  user: User,
  uid: string,
  disabled: boolean
): Promise<void> {
  const res = await adminFetch(user, `/admin/users/${encodeURIComponent(uid)}/status`, {
    method: "POST",
    body: JSON.stringify({ disabled }),
  });
  await handleAdminResponse(res);
}

