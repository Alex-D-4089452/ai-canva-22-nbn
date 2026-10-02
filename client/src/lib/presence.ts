import type { PresenceUser } from "../types/index.js";

/** One row of the "who's on this board" roster. */
export interface RosterEntry {
  email: string;
  name: string;
  initials: string;
  color: string;
  /** The currently signed-in user. */
  isSelf: boolean;
}

export interface Roster {
  /** People with the board open right now (presence heartbeat fresh). */
  online: RosterEntry[];
  /** Board collaborators who are NOT online right now (emails). */
  offline: string[];
}

const norm = (e: string) => e.trim().toLowerCase();

/**
 * Builds the board roster shown in the header: currently-online users (from
 * presence) plus collaborators who are shared on the board but not online
 * right now. Emails are compared case-insensitively. The signed-in user is
 * sorted first and flagged with `isSelf`.
 */
export function groupRoster(
  activeUsers: PresenceUser[],
  collaborators: string[],
  selfEmail?: string
): Roster {
  const self = norm(selfEmail || "");
  const seen = new Set<string>();

  const online: RosterEntry[] = [];
  for (const u of activeUsers) {
    const email = norm(u.email || u.userId);
    if (seen.has(email)) continue;
    seen.add(email);
    online.push({
      email: u.email || u.userId,
      name: u.displayName || u.email || "Someone",
      initials: u.initials || u.email.slice(0, 2).toUpperCase(),
      color: u.color || "#94a3b8",
      isSelf: !!self && email === self,
    });
  }
  online.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.email.localeCompare(b.email));

  const offline: string[] = [];
  for (const c of collaborators) {
    const email = norm(c);
    if (!email || seen.has(email) || offline.includes(email)) continue;
    offline.push(email);
  }

  return { online, offline };
}