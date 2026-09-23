/**
 * Firebase ID-token verification for the local dev server.
 *
 * The Cloud Function uses `firebase-admin`'s `verifyIdToken` (it already has
 * the Admin SDK). The local server has no service account, and token
 * *verification* does not need one — Firebase ID tokens are RS256 JWTs signed
 * with Google's public securetoken keys, which anyone can fetch. So this
 * module does the verification with node:crypto and no extra dependency.
 *
 * Same contract as the functions-side helper: returns `{ uid }` on success or
 * `{ status, error }` on failure, so routes can respond uniformly.
 */

import { createVerify, X509Certificate } from "crypto";
import type { Request } from "express";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CERTS_TTL_MS = 6 * 60 * 60 * 1000; // Google rotates with long overlap

/** Matches the projectId hardcoded in client/src/lib/firebase.ts. */
function projectId(): string {
  return process.env.FIREBASE_PROJECT_ID || "ai-canva-22-nbn-fee4b";
}

let certs: Record<string, string> | null = null;
let certsFetchedAt = 0;

async function getSigningCerts(): Promise<Record<string, string>> {
  if (certs && Date.now() - certsFetchedAt < CERTS_TTL_MS) return certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google signing certs (HTTP ${res.status})`);
  }
  const body = (await res.json()) as Record<string, string>;
  certs = body;
  certsFetchedAt = Date.now();
  return certs;
}

/** Test seam: drop the cached certs (used by unit tests). */
export function clearCertCache(): void {
  certs = null;
  certsFetchedAt = 0;
}

function b64urlDecode(value: string): Buffer {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

/**
 * Verifies a Firebase ID token (iss/aud/exp + RS256 signature against
 * Google's securetoken certs). Throws on any failure.
 */
export async function verifyFirebaseIdToken(token: string): Promise<{ uid: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(b64urlDecode(headerB64).toString("utf8")) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported token header");

  const payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    user_id?: string;
  };

  const project = projectId();
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) throw new Error("Token expired");
  if (payload.iss !== `https://securetoken.google.com/${project}`) {
    throw new Error("Invalid issuer");
  }
  if (payload.aud !== project) throw new Error("Invalid audience");
  const uid = payload.user_id || payload.sub;
  if (!uid) throw new Error("Missing subject");

  const signingCerts = await getSigningCerts();
  const pem = signingCerts[header.kid];
  if (!pem) throw new Error("Unknown signing key");

  const publicKey = new X509Certificate(pem).publicKey;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  if (!verifier.verify(publicKey, b64urlDecode(signatureB64))) {
    throw new Error("Bad signature");
  }
  return { uid };
}

/**
 * Verifies `Authorization: Bearer <token>` on a request. Returns the caller's
 * UID on success, or an error descriptor `{ status, error }` on failure.
 */
export async function requireAuth(
  req: Request
): Promise<{ uid: string } | { status: number; error: string }> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { status: 401, error: "Missing authorization token" };
  }
  try {
    const { uid } = await verifyFirebaseIdToken(token);
    return { uid };
  } catch {
    return { status: 401, error: "Invalid or expired token" };
  }
}
