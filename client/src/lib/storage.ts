import { auth } from "./firebase.js";
import { API_BASE } from "./api.js";

/**
 * Uploads a file to Cloudflare R2 via the backend's sign endpoint.
 *
 * The browser never holds R2 credentials: we ask POST /api/storage/sign for a
 * short-lived presigned PUT URL (authenticated with the Firebase ID token),
 * upload straight to R2, and return the durable public URL — which is what
 * gets stored in Firestore for real-time sync. See server/src/r2.ts (and its
 * functions/ twin) for the key rules.
 */
async function signAndUpload(
  key: string,
  contentType: string,
  body: BodyInit
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }
  const token = await user.getIdToken();
  const signRes = await fetch(`${API_BASE}/storage/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, contentType }),
  });
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({ error: `HTTP ${signRes.status}` }));
    throw new Error(err.error || `HTTP ${signRes.status}`);
  }
  const { uploadUrl, downloadUrl } = (await signRes.json()) as {
    uploadUrl: string;
    downloadUrl: string;
  };
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (HTTP ${putRes.status})`);
  }
  return downloadUrl;
}

/**
 * Uploads a base64 data URL to R2 and returns a fetchable URL.
 * The URL is small and can be safely saved to Firestore for real-time sync.
 */
export async function uploadImageToStorage(
  boardId: string,
  boxId: string,
  dataUrl: string
): Promise<string> {
  const key = `boards/${boardId}/images/${boxId}.jpg`;
  // Decode the data URL to bytes so the presigned PUT carries the JPEG body.
  const blob = await (await fetch(dataUrl)).blob();
  return signAndUpload(key, "image/jpeg", blob);
}

/**
 * Uploads a document file (PDF/DOCX/TXT/…) to the board's documents path and
 * returns a fetchable URL. Best-effort by design: the Documents box keeps the
 * extracted text in boxData even when this fails (signed-out local mode,
 * permission errors) — the URL is only for re-downloading the original file.
 */
export async function uploadDocumentToStorage(
  boardId: string,
  boxId: string,
  file: File
): Promise<string> {
  // Storage paths must be filesystem-safe — keep the name conservative.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `boards/${boardId}/documents/${boxId}/${Date.now()}-${safeName}`;
  return signAndUpload(key, file.type || "application/octet-stream", file);
}
