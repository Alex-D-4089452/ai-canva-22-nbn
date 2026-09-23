/**
 * Cloudflare R2 object storage — board images and documents.
 *
 * Replaces Firebase Storage. The browser never holds R2 credentials: the
 * backend mints a short-lived presigned PUT URL from POST /api/storage/sign,
 * the client uploads straight to R2, and the durable public URL is stored in
 * Firestore for real-time sync. Reads use the bucket's public r2.dev base
 * (same effective model as Firebase's download-token URLs: anyone with the
 * URL can open the file).
 *
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 * R2_PUBLIC_BASE_URL (the bucket's Public Development URL, e.g.
 * https://pub-xxxx.r2.dev).
 *
 * IMPORTANT: this file is duplicated as `functions/src/r2.ts` (the API logic
 * is intentionally duplicated between the local Express server and the Cloud
 * Function). Keep the two in sync.
 */

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Thrown when the R2_* env vars are missing — maps to a 501 from the route. */
export class R2ConfigError extends Error {
  constructor(message = "R2 storage is not configured") {
    super(message);
    this.name = "R2ConfigError";
  }
}

interface R2Config {
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
}

function readConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new R2ConfigError(
      "R2 is not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL)"
    );
  }
  return { accountId, bucket, publicBaseUrl };
}

// Lazily created so importing this module never throws in tests or boot
// before the env is loaded.
let client: S3Client | null = null;
let clientAccountId = "";

function getClient(accountId: string): S3Client {
  if (!client || clientAccountId !== accountId) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    clientAccountId = accountId;
  }
  return client;
}

// === Key validation — the sign endpoint only ever writes board files ===

// boards/{boardId}/images/{boxId}.jpg  (box ids are `box-<ts>-<rand>`)
const IMAGE_KEY = /^boards\/[A-Za-z0-9_-]+\/images\/[A-Za-z0-9_-]+\.jpg$/;
// boards/{boardId}/documents/{boxId}/{timestamp}-{safeName}
// safeName = file.name with anything outside [a-zA-Z0-9._-] replaced by "_"
const DOCUMENT_KEY =
  /^boards\/[A-Za-z0-9_-]+\/documents\/[A-Za-z0-9_-]+\/[0-9]+-[A-Za-z0-9._-]+$/;

/**
 * True when `key` is a well-formed board image or document path. Anything
 * else (parent traversal, other prefixes, absurd lengths) is refused, so the
 * sign endpoint cannot be used as a general bucket-write proxy.
 */
export function validateStorageKey(key: unknown): key is string {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) return false;
  return IMAGE_KEY.test(key) || DOCUMENT_KEY.test(key);
}

/** Basic MIME-type sanity check (type/subtype, no control characters). */
export function isValidContentType(contentType: unknown): contentType is string {
  if (typeof contentType !== "string") return false;
  if (contentType.length === 0 || contentType.length > 128) return false;
  for (let i = 0; i < contentType.length; i++) {
    const code = contentType.charCodeAt(i);
    if (code < 32 || code === 127) return false;
  }
  return /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+/.test(contentType);
}

/**
 * Mints a presigned PUT URL for `key` (default TTL 15 minutes). The client
 * must send the same `Content-Type` header — it is part of the signature.
 */
export async function signUpload(key: string, contentType: string): Promise<string> {
  const config = readConfig();
  const s3 = getClient(config.accountId);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

/** Durable public URL for an object (bucket's r2.dev public base + key). */
export function publicUrl(key: string): string {
  const config = readConfig();
  return `${config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
}

/** Sums object sizes/counts across the whole bucket (admin stats). */
export async function listStorageUsage(): Promise<{ bytes: number; files: number }> {
  const config = readConfig();
  const s3 = getClient(config.accountId);
  let bytes = 0;
  let files = 0;
  let continuationToken: string | undefined;
  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        ContinuationToken: continuationToken,
      })
    );
    for (const object of result.Contents ?? []) {
      bytes += object.Size ?? 0;
      files += 1;
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return { bytes, files };
}
