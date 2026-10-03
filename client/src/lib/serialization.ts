import type { BoxData } from "../types/index.js";

/**
 * Cleans per-box data before persisting to Firestore.
 *
 * - Drops `undefined` values (Firestore's updateDoc rejects them).
 * - Strips base64 `imageData` (can exceed Firestore's 1MB document limit) but
 *   keeps already-uploaded image URLs (strings not starting with `data:`).
 *
 * Extracted from boardStore so the serialization rules can be unit-tested.
 */
export function cleanBoxDataForFirestore(
  boxData: Record<string, BoxData>
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(boxData).map(([id, data]) => {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        // Strip base64 imageData (too large for Firestore) but keep URLs.
        if (
          key === "imageData" &&
          typeof value === "string" &&
          value.startsWith("data:")
        ) {
          continue;
        }
        cleaned[key] = value;
      }
      return [id, cleaned];
    })
  );
}
