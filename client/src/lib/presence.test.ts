import { describe, expect, it } from "vitest";
import { groupRoster } from "./presence.js";
import type { PresenceUser } from "../types/index.js";

const u = (over: Partial<PresenceUser> = {}): PresenceUser => ({
  userId: "uid",
  email: "a@x.co",
  displayName: "A",
  initials: "A",
  color: "#f00",
  cursorX: 0,
  cursorY: 0,
  ...over,
});

describe("groupRoster", () => {
  it("lists online users and marks the signed-in one", () => {
    const r = groupRoster(
      [u({ userId: "1", email: "me@x.co" }), u({ userId: "2", email: "b@x.co" })],
      [],
      "me@x.co"
    );
    expect(r.online).toHaveLength(2);
    expect(r.online[0].isSelf).toBe(true); // self sorted first
    expect(r.online[0].email).toBe("me@x.co");
    expect(r.online[1].isSelf).toBe(false);
  });

  it("compares emails case-insensitively for the self marker", () => {
    const r = groupRoster([u({ email: "ME@x.co" })], [], "me@x.co");
    expect(r.online[0].isSelf).toBe(true);
  });

  it("puts collaborators who are not online into offline", () => {
    const r = groupRoster([u({ email: "a@x.co" })], ["a@x.co", "gone@x.co"], "a@x.co");
    expect(r.online.map((o) => o.email)).toEqual(["a@x.co"]);
    expect(r.offline).toEqual(["gone@x.co"]);
  });

  it("dedupes collaborators (case-insensitive) and online entries", () => {
    const r = groupRoster(
      [u({ userId: "1", email: "a@x.co" }), u({ userId: "2", email: "A@x.co" })],
      ["A@x.co", "a@x.co", "c@x.co"],
      "b@x.co"
    );
    expect(r.online).toHaveLength(1);
    expect(r.offline).toEqual(["c@x.co"]);
  });

  it("falls back to userId when email is missing", () => {
    const r = groupRoster([u({ email: "", userId: "anon123" })], [], "me@x.co");
    expect(r.online[0].email).toBe("anon123");
    expect(r.online[0].isSelf).toBe(false);
  });

  it("handles an empty board", () => {
    const r = groupRoster([], [], "me@x.co");
    expect(r.online).toEqual([]);
    expect(r.offline).toEqual([]);
  });
});