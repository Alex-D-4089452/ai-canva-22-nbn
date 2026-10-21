import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  fetchAdminStats,
  fetchUsers,
  setUserBlocked,
  setFacilitatorRole,
  type AdminStats,
  type AdminUser,
} from "../lib/admin.js";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + units[i];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function formatNum(n: number): string {
  return (n || 0).toLocaleString("en-US");
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
}

function StatCard({ label, value, sub, icon, accent }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

type Tab = "overview" | "users";

export default function AdminBoard({ user, onBack }: { user: User; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");

  // Overview stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Users list
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const loadStats = async (silent = false) => {
    if (!silent) setStatsLoading(true);
    setStatsError(null);
    try {
      setStats(await fetchAdminStats(user));
    } catch (err: any) {
      setStatsError(err.message || "Failed to load admin stats");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadUsers = async (pageToken?: string) => {
    setUsersError(null);
    if (!pageToken) setUsersLoading(true);
    try {
      const res = await fetchUsers(user, pageToken);
      if (pageToken) {
        setUsers((prev) => [...prev, ...res.users]);
      } else {
        setUsers(res.users);
      }
      setNextPageToken(res.nextPageToken);
    } catch (err: any) {
      setUsersError(err.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (tab === "users" && users.length === 0) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleToggleFacilitator = async (target: AdminUser) => {
    setBusyUid(target.uid);
    try {
      await setFacilitatorRole(user, target.uid, !target.facilitator);
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, facilitator: !u.facilitator } : u)));
    } catch (err: any) {
      alert(err?.message || "Failed to update role");
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleBlock = async (target: AdminUser) => {
    const action = target.disabled ? "unblock" : "block";
    if (!confirm(`Are you sure you want to ${action} ${target.email || target.uid}?`)) return;
    setBusyUid(target.uid);
    try {
      await setUserBlocked(user, target.uid, !target.disabled);
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, disabled: !u.disabled } : u)));
    } catch (err: any) {
      alert(err.message || `Failed to ${action} user`);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🛠️ Admin Board</h1>
            <p className="text-sm text-slate-500">System-wide management for relay</p>
          </div>
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            ← Back to canvas
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {(["overview", "users"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize " +
                (tab === t ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}
            >
              {t === "overview" ? "📊 Overview" : "👥 Users"}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            {statsError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <span className="font-medium">Could not load stats:</span> {statsError}
              </div>
            )}

            {statsLoading && !stats && (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <span className="animate-spin mr-2">⏳</span> Loading stats...
              </div>
            )}

            {stats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <StatCard label="Total Users" value={String(stats.users.total)} icon="👥" accent="#3b82f6" />
                  <StatCard label="Active Now" value={String(stats.users.activeLast5m)} sub="last 5 minutes" icon="🟢" accent="#22c55e" />
                  <StatCard label="New Users" value={String(stats.users.newLast7d)} sub="last 7 days" icon="✨" accent="#8b5cf6" />
                  <StatCard label="Total Boards" value={String(stats.boards.total)} icon="📋" accent="#f59e0b" />
                  <StatCard label="New Boards" value={String(stats.boards.newLast7d)} sub="last 7 days" icon="🆕" accent="#ec4899" />
                  <StatCard label="Storage Used" value={formatBytes(stats.storage.bytes)} sub={stats.storage.files + " files"} icon="💾" accent="#14b8a6" />
                  <StatCard
                    label="LLM Tokens Used"
                    value={formatNum(stats.tokens.totalTokens)}
                    sub={formatNum(stats.tokens.promptTokens) + " in · " + formatNum(stats.tokens.completionTokens) + " out"}
                    icon="⚡"
                    accent="#6366f1"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                  <span>Last updated {new Date(stats.generatedAt).toLocaleString()}</span>
                  <button
                    onClick={() => loadStats(true)}
                    disabled={statsLoading}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition disabled:opacity-60"
                  >
                    {statsLoading ? "Refreshing..." : "↻ Refresh"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {tab === "users" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700">Registered Users ({users.length})</span>
              <button
                onClick={() => loadUsers()}
                disabled={usersLoading}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-60"
              >
                {usersLoading ? "Loading..." : "↻ Refresh"}
              </button>
            </div>

            {usersError && (
              <div className="p-4 text-sm text-red-700 bg-red-50 border-b border-red-200">{usersError}</div>
            )}

            {usersLoading && users.length === 0 && (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <span className="animate-spin mr-2">⏳</span> Loading users...
              </div>
            )}

            {!usersLoading && usersError && users.length === 0 && (
              <div className="py-16 text-center text-slate-400 text-sm">Could not load users.</div>
            )}

            {users.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-5 py-2.5">User</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right hidden md:table-cell">Tokens ⬆</th>
                    <th className="px-4 py-2.5 text-right hidden md:table-cell">Tokens ⬇</th>
                    <th className="px-4 py-2.5 hidden lg:table-cell">Signed Up</th>
                    <th className="px-4 py-2.5 hidden xl:table-cell">Last Sign-in</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                              {(u.displayName || u.email || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-slate-700 truncate">{u.displayName || "—"}</div>
                            <div className="text-xs text-slate-400 truncate">{u.email || u.uid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={"inline-block px-2 py-0.5 rounded-full text-xs font-medium " + (u.disabled ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                          {u.disabled ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className={"inline-block px-2 py-0.5 rounded-full text-xs font-medium " + (u.facilitator ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400")}>
                            {u.facilitator ? "Facilitator" : "—"}
                          </span>
                          {u.uid !== user.uid && (
                            <button
                              onClick={() => handleToggleFacilitator(u)}
                              disabled={busyUid === u.uid}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-60"
                              title={u.facilitator ? "Revoke the facilitator role" : "Grant the facilitator role"}
                            >
                              {u.facilitator ? "Revoke" : "Grant"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <div className="text-sm text-slate-700 font-medium tabular-nums">{formatNum(u.tokens?.promptTokens)}</div>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <div className="text-sm text-slate-700 font-medium tabular-nums">{formatNum(u.tokens?.completionTokens)}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3 hidden xl:table-cell text-slate-500">{formatDate(u.lastSignIn)}</td>
                      <td className="px-4 py-3 text-right">
                        {u.uid === user.uid ? (
                          <span className="text-xs text-slate-400">(you)</span>
                        ) : (
                          <button
                            onClick={() => handleToggleBlock(u)}
                            disabled={busyUid === u.uid}
                            className={"px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-60 " +
                              (u.disabled
                                ? "bg-green-50 text-green-700 hover:bg-green-100"
                                : "bg-red-50 text-red-700 hover:bg-red-100")}
                          >
                            {busyUid === u.uid ? "..." : u.disabled ? "Unblock" : "Block"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {nextPageToken && (
              <div className="px-5 py-3 border-t border-slate-100">
                <button
                  onClick={() => loadUsers(nextPageToken)}
                  disabled={usersLoading}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-60"
                >
                  {usersLoading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
