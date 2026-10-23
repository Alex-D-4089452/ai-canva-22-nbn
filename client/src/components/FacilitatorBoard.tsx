import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { deleteBoard, listTemplateBoards, type BoardDoc } from "../lib/firestore.js";
import {
  MAX_TEAM_MEMBERS,
  createTeamFromTemplate,
  createTemplateBoard,
  createWorkshop,
  deleteTeam,
  deleteWorkshop,
  listCodes,
  listTeams,
  listWorkshops,
  regenerateCode,
  setBoardTemplate,
  type SeatCode,
  type Team,
  type Workshop,
} from "../lib/workshop.js";

type Tab = "templates" | "workshops" | "teams";

interface FacilitatorBoardProps {
  user: User;
  onBack: () => void;
  /** Opens a board in the editor (used for templates). */
  onOpenBoard: (boardId: string) => void;
}

/**
 * Facilitator Dashboard — for facilitators and admins. Three tabs:
 *  - Templates: workshop board templates (ordinary boards flagged isTemplate)
 *  - Workshops: create/manage workshops
 *  - Teams: workshop-scoped teams of up to 5 guests, created from templates,
 *    with per-seat join codes
 */
export default function FacilitatorBoard({ user, onBack, onOpenBoard }: FacilitatorBoardProps) {
  const [tab, setTab] = useState<Tab>("workshops");

  // Templates
  const [templates, setTemplates] = useState<BoardDoc[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Workshops
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [workshopName, setWorkshopName] = useState("");
  const [workshopDesc, setWorkshopDesc] = useState("");
  const [workshopsLoading, setWorkshopsLoading] = useState(false);

  // Teams
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [codesByTeam, setCodesByTeam] = useState<Record<string, SeatCode[]>>({});
  const [teamName, setTeamName] = useState("");
  const [teamTemplateId, setTeamTemplateId] = useState("");
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  const me = { uid: user.uid, email: user.email || "" };

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      setTemplates(await listTemplateBoards(user.uid));
    } catch (err) {
      console.error("[facilitator] templates load failed:", err);
    } finally {
      setTemplatesLoading(false);
    }
  }, [user.uid]);

  const loadWorkshops = useCallback(async () => {
    setWorkshopsLoading(true);
    try {
      const ws = await listWorkshops(user.uid);
      setWorkshops(ws);
      setSelectedWorkshopId((prev) => prev || ws[0]?.id || "");
    } catch (err) {
      console.error("[facilitator] workshops load failed:", err);
    } finally {
      setWorkshopsLoading(false);
    }
  }, [user.uid]);

  const loadTeams = useCallback(async (workshopId: string) => {
    if (!workshopId) {
      setTeams([]);
      setCodesByTeam({});
      return;
    }
    setTeamsLoading(true);
    try {
      const ts = await listTeams(workshopId);
      setTeams(ts);
      const codeEntries = await Promise.all(
        ts.map(async (t) => [t.id, t.boardId ? await listCodes(t.id).catch(() => []) : []] as const)
      );
      setCodesByTeam(Object.fromEntries(codeEntries));
    } catch (err) {
      console.error("[facilitator] teams load failed:", err);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadWorkshops();
  }, [loadTemplates, loadWorkshops]);

  useEffect(() => {
    loadTeams(selectedWorkshopId);
  }, [selectedWorkshopId, loadTeams]);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          🧑‍🏫 Facilitator Dashboard
        </h1>
        <button
          onClick={onBack}
          className="rounded-lg bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
        >
          ← Back to board
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 bg-white px-5 py-2">
        {(["workshops", "teams", "templates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition " +
              (tab === t ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {/* ===== WORKSHOPS ===== */}
        {tab === "workshops" && (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-700">New workshop</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
                  placeholder="Workshop name (e.g. Design Thinking 101)"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                />
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
                  placeholder="Description (optional)"
                  value={workshopDesc}
                  onChange={(e) => setWorkshopDesc(e.target.value)}
                />
                <button
                  disabled={!workshopName.trim() || workshopsLoading}
                  onClick={() =>
                    run(async () => {
                      await createWorkshop(me, workshopName, workshopDesc);
                      setWorkshopName("");
                      setWorkshopDesc("");
                      await loadWorkshops();
                    })
                  }
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>

            {workshops.map((w) => (
              <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{w.name}</h3>
                    <p className="text-xs text-slate-500">{w.description || "No description"}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Created {new Date(w.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedWorkshopId(w.id);
                        setTab("teams");
                      }}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                    >
                      Teams →
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await deleteWorkshop(w.id);
                          await loadWorkshops();
                        })
                      }
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                      title="Delete workshop (teams must be deleted first)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!workshopsLoading && workshops.length === 0 && (
              <p className="text-center text-sm text-slate-400">No workshops yet — create one above.</p>
            )}
          </div>
        )}

        {/* ===== TEAMS ===== */}
        {tab === "teams" && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-bold text-slate-700">Create a team</h2>
              <p className="mb-3 text-xs text-slate-500">
                Teams copy a template board and get {MAX_TEAM_MEMBERS} seat codes for guests.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden"
                  value={selectedWorkshopId}
                  onChange={(e) => setSelectedWorkshopId(e.target.value)}
                >
                  <option value="">Select workshop…</option>
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden"
                  value={teamTemplateId}
                  onChange={(e) => setTeamTemplateId(e.target.value)}
                >
                  <option value="">Select template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
                  placeholder="Team name (e.g. Team Alpha)"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
                <button
                  disabled={!selectedWorkshopId || !teamTemplateId || !teamName.trim()}
                  onClick={() =>
                    run(async () => {
                      const workshop = workshops.find((w) => w.id === selectedWorkshopId)!;
                      const template = templates.find((t) => t.id === teamTemplateId)!;
                      await createTeamFromTemplate({
                        workshop,
                        name: teamName,
                        template,
                        facilitatorUid: me.uid,
                        facilitatorEmail: me.email,
                        newBoardId: () =>
                          `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      });
                      setTeamName("");
                      await loadTeams(selectedWorkshopId);
                    })
                  }
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  Create team
                </button>
              </div>
            </div>

            {teams.map((t) => {
              const codes = codesByTeam[t.id] || [];
              const claimed = codes.filter((c) => c.claimed).length;
              return (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{t.name}</h3>
                      <p className="text-xs text-slate-500">
                        Seats: {claimed}/{t.maxMembers} claimed
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {t.boardId && (
                        <button
                          onClick={() => onOpenBoard(t.boardId)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                        >
                          Open board
                        </button>
                      )}
                      <button
                        onClick={() =>
                          run(async () => {
                            await deleteTeam(t);
                            await loadTeams(selectedWorkshopId);
                          })
                        }
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                        title="Delete the team, its board, and its codes"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {codes.map((c) => (
                      <div
                        key={c.code}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <code className="text-sm font-bold tracking-wider text-slate-800">
                            {c.code}
                          </code>
                          <span className="ml-2 text-[11px] text-slate-400">
                            {c.claimed ? "claimed" : "unclaimed"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyCode(c.code)}
                            className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-600 border border-slate-200 hover:bg-slate-100 transition"
                            title="Copy code"
                          >
                            {copied === c.code ? "✓ Copied" : "Copy"}
                          </button>
                          {!c.claimed && (
                            <button
                              onClick={() =>
                                run(async () => {
                                  await regenerateCode(t.id, t.workshopId, c.code);
                                  await loadTeams(selectedWorkshopId);
                                })
                              }
                              className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-100 transition"
                              title="Replace this unused code"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {selectedWorkshopId && !teamsLoading && teams.length === 0 && (
              <p className="text-center text-sm text-slate-400">
                No teams in this workshop yet — create one above.
              </p>
            )}
            {!selectedWorkshopId && (
              <p className="text-center text-sm text-slate-400">Select a workshop to manage its teams.</p>
            )}
          </div>
        )}

        {/* ===== TEMPLATES ===== */}
        {tab === "templates" && (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-sm font-bold text-slate-700">New template board</h2>
              <p className="mb-3 text-xs text-slate-500">
                Templates are ordinary boards — build them with any box types, then create teams from them.
              </p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
                  placeholder="Template name (e.g. Empathy Map Exercise)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <button
                  disabled={!templateName.trim()}
                  onClick={() =>
                    run(async () => {
                      const id = await createTemplateBoard(me, templateName);
                      setTemplateName("");
                      await loadTemplates();
                      onOpenBoard(id);
                    })
                  }
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  Create & open
                </button>
              </div>
            </div>

            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{t.title}</h3>
                    <p className="text-xs text-slate-500">
                      {(t.nodes as unknown[]).length} boxes · updated {new Date(t.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onOpenBoard(t.id)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                    >
                      Open
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await setBoardTemplate(t.id, false);
                          await loadTemplates();
                        })
                      }
                      className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 border border-slate-200"
                      title="Turn back into a regular board"
                    >
                      Unlist
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await deleteBoard(t.id);
                          await loadTemplates();
                        })
                      }
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!templatesLoading && templates.length === 0 && (
              <p className="text-center text-sm text-slate-400">No templates yet — create one above.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}