import { memo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useBoardStore } from "../store/boardStore.js";
import { useTokenStore } from "../store/tokenStore.js";
import { useUIStore } from "../store/uiStore.js";
import { Button } from "./ui/Button.js";
import { Menu, MenuDivider, MenuItem } from "./ui/Menu.js";
import PresenceRoster from "./PresenceRoster.js";
import { pipelineOrder } from "../lib/pipeline.js";
import { resolveBoxType } from "../lib/status.js";
import { runInputBlocker } from "../lib/inputs.js";
import { BOX_TYPES } from "../types/index.js";
import {
  migrateBoardsFromCarbondocs,
  exportBoardsJson,
  parseBoardsExport,
  importBoards,
} from "../lib/migrate.js";

/**
 * Top app bar — the app's primary chrome (dark, near-black).
 *
 * Calm two-group bar:
 *   left  — brand mark, board title, save status
 *   right — collaboration (roster / Share), usage badge, Run all, board
 *           actions (Boards menu), role-gated views, account menu
 *
 * Rare + destructive actions (Clear / Delete board, Sign out) live inside
 * menus instead of the bar itself. The add-box palette is toggled from the
 * left canvas rail, not the bar.
 *
 * Performance: this component subscribes to the store slices it renders
 * (title, save status, board list). App does NOT — so typing in the board
 * title re-renders only this (memoized) header, not the whole Canvas tree.
 */

const SAVE_LABEL: Record<string, string> = {
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

interface HeaderProps {
  user: User;
  onShare: () => void;
  onNewBoard: () => void;
  onLoadBoard: (boardId: string) => void;
  onDeleteBoard: () => void;
  onClearBoard: () => void;
  onLogout: () => void;
  isAdmin: boolean;
  isFacilitator: boolean;
  adminView: boolean;
  facilitatorView: boolean;
  onToggleAdminView: () => void;
  onToggleFacilitatorView: () => void;
}

function Header({
  user,
  onShare,
  onNewBoard,
  onLoadBoard,
  onDeleteBoard,
  onClearBoard,
  onLogout,
  isAdmin,
  isFacilitator,
  adminView,
  facilitatorView,
  onToggleAdminView,
  onToggleFacilitatorView,
}: HeaderProps) {
  // Store slices the header itself renders (kept out of App on purpose).
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const boardTitle = useBoardStore((s) => s.boardTitle);
  const setBoardTitle = useBoardStore((s) => s.setBoardTitle);
  const saveStatus = useBoardStore((s) => s.saveStatus);
  const boardList = useBoardStore((s) => s.boardList);
  const refreshBoardList = useBoardStore((s) => s.refreshBoardList);

  const totalTokens = useTokenStore((s) => s.totalTokens);
  const fmtTokens = (n: number) => n.toLocaleString("en-US");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferMsg, setTransferMsg] = useState("");
  const [runAllBusy, setRunAllBusy] = useState(false);

  const runMigrate = async () => {
    if (transferBusy) return;
    setTransferBusy(true);
    setTransferMsg("Signing in to carbondocs…");
    try {
      const r = await migrateBoardsFromCarbondocs();
      const parts = [`${r.migrated} migrated`, `${r.skipped} skipped`];
      if (r.shared) parts.push(`${r.shared} shared`);
      if (r.errors.length) parts.push(`${r.errors.length} errors`);
      setTransferMsg(parts.join(" · "));
      await refreshBoardList();
    } catch (err: any) {
      setTransferMsg(err?.message || "Migration failed");
    } finally {
      setTransferBusy(false);
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file || transferBusy) return;
    setTransferBusy(true);
    setTransferMsg("Importing…");
    try {
      const boards = await parseBoardsExport(file);
      const r = await importBoards(boards);
      setTransferMsg(
        `${r.imported} imported · ${r.skipped} skipped` +
          (r.errors.length ? ` · ${r.errors.length} errors` : "")
      );
      await refreshBoardList();
    } catch (err: any) {
      setTransferMsg(err?.message || "Import failed");
    } finally {
      setTransferBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /**
   * Run every ready box in board order (pipeline order: upstream boxes
   * before the boxes that consume them). Boxes the input gates refuse are
   * skipped silently — Run all must never flip a half-connected box to
   * "error"; the box pill already shows what it is waiting for.
   */
  const handleRunAll = async () => {
    if (runAllBusy) return;
    setRunAllBusy(true);
    try {
      const ordered = pipelineOrder(
        useBoardStore.getState().nodes,
        useBoardStore.getState().edges
      );
      let ran = 0;
      for (const node of ordered) {
        const state = useBoardStore.getState();
        const type = resolveBoxType((node.data?.boxType || node.type) as string | undefined);
        if (!type || !BOX_TYPES[type].hasAI) continue;
        if (state.boxData[node.id]?.status === "running") continue;
        if (runInputBlocker(type, state.nodes, state.edges, state.boxData, node.id)) continue;
        await state.runBox(node.id);
        ran++;
      }
      useUIStore
        .getState()
        .showToast(
          ran === 0
            ? "Nothing to run yet — add input or a task first."
            : `Ran ${ran} box${ran === 1 ? "" : "es"} in board order.`
        );
    } finally {
      setRunAllBusy(false);
    }
  };

  const saveLabel = SAVE_LABEL[saveStatus];
  const avatarInitials = (user.displayName || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <header className="app-bar flex items-center justify-between gap-3 px-4 h-14 relative z-40">
      {/* ---- Left: brand + board identity ---- */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="logo-tile" aria-hidden>
            🎨
          </div>
          <span className="hidden sm:inline text-[15px] font-bold tracking-tight text-white">
            relay
          </span>
        </div>

        {currentBoardId ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <input
              type="text"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              placeholder="Untitled board"
              className="h-8 w-48 md:w-60 rounded-lg border border-transparent bg-white/5 px-2.5 text-[13px] font-medium text-white transition hover:border-white/10 hover:bg-white/10 focus:border-indigo-400/70 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {saveLabel && (
              <span
                className="flex items-center gap-1.5 flex-shrink-0"
                title={"Board save status: " + saveLabel}
              >
                <span className={"save-dot save-" + saveStatus} />
                <span className="text-[11px] text-slate-400 hidden md:block">{saveLabel}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-500">Opening board…</span>
        )}
      </div>

      {/* ---- Right: actions ---- */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Collaboration + usage group */}
        {currentBoardId && (
          <>
            <PresenceRoster />
            <div
              className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 tabular-nums"
              title={"Your total LLM tokens used: " + fmtTokens(totalTokens)}
            >
              ⚡ <span className="font-semibold text-white">{fmtTokens(totalTokens)}</span>
              <span className="hidden md:inline">tokens</span>
            </div>
          </>
        )}

        {/* Role-gated views */}
        {isAdmin && (
          <Button
            variant="ghostLight"
            active={adminView}
            onClick={onToggleAdminView}
            title="Admin board — system stats and users"
          >
            🛠️ Admin
          </Button>
        )}
        {(isAdmin || isFacilitator) && (
          <Button
            variant="ghostLight"
            active={facilitatorView}
            onClick={onToggleFacilitatorView}
            title="Facilitator dashboard — templates, workshops, teams"
          >
            🧑‍🏫 Facilitator
          </Button>
        )}

        {/* Boards + Run all stay available before a board opens (the E2E
            suite also looks for "Boards (" with a board-less fake user);
            Share only makes sense once there is a board to share. */}
        <>
            <Menu
              panelClassName="w-72"
              trigger={({ open, toggle }) => (
                <Button
                  variant="onDark"
                  onClick={() => {
                    if (!open) refreshBoardList();
                    toggle();
                  }}
                  active={open}
                  title="Open, create, or manage boards"
                >
                  Boards ({boardList.length})
                  <span className={"text-[10px] transition-transform " + (open ? "rotate-180" : "")}>
                    ▾
                  </span>
                </Button>
              )}
            >
              {(close) => (
                <>
                  <div className="max-h-80 overflow-y-auto">
                    <MenuItem
                      icon="＋"
                      label="New Board"
                      accent
                      onClick={() => {
                        close();
                        onNewBoard();
                      }}
                    />
                    {boardList.length === 0 && (
                      <div className="px-3.5 py-3 text-xs text-slate-400">No boards yet.</div>
                    )}
                    {boardList.map((b) => (
                      <MenuItem
                        key={b.id}
                        label={b.title || "Untitled board"}
                        description={
                          new Date(b.updatedAt).toLocaleDateString() +
                          " · " +
                          (Array.isArray(b.nodes) ? b.nodes.length : 0) +
                          " boxes"
                        }
                        active={b.id === currentBoardId}
                        onClick={() => {
                          close();
                          onLoadBoard(b.id);
                        }}
                      />
                    ))}
                  </div>
                  {currentBoardId && (
                    <>
                      <MenuDivider />
                      <MenuItem
                        icon="🧹"
                        label="Clear this board"
                        description="Remove all boxes"
                        danger
                        onClick={() => {
                          close();
                          onClearBoard();
                        }}
                      />
                      <MenuItem
                        icon="🗑"
                        label="Delete this board"
                        description="Remove it from the cloud"
                        danger
                        onClick={() => {
                          close();
                          onDeleteBoard();
                        }}
                      />
                    </>
                  )}
                  <MenuDivider />
                  <MenuItem
                    icon="⬇"
                    label="Export boards (JSON)"
                    description="Download every board in the list"
                    onClick={() => {
                      exportBoardsJson(boardList);
                      setTransferMsg(`Exported ${boardList.length} boards`);
                    }}
                  />
                  <MenuItem
                    icon="⬆"
                    label="Import boards (JSON)"
                    description="Load a previously exported file"
                    onClick={() => {
                      close();
                      fileInputRef.current?.click();
                    }}
                  />
                  <MenuItem
                    icon="🔄"
                    label={
                      transferBusy
                        ? "Working…"
                        : "Migrate from carbondocs"
                    }
                    description="Copy boards from the old Firebase project"
                    onClick={() => {
                      close();
                      runMigrate();
                    }}
                  />
                  {transferMsg && (
                    <div className="px-3.5 py-2 text-[11px] text-slate-500 leading-snug">
                      {transferMsg}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => onImportFile(e.target.files?.[0])}
                  />
                </>
              )}
            </Menu>

            {currentBoardId && (
              <Button variant="outlineLight" onClick={onShare} title="Share this board">
                Share
              </Button>
            )}

            <Button
              variant="primary"
              onClick={handleRunAll}
              disabled={runAllBusy}
              title="Run every ready box in board order"
            >
              {/* Play glyph is an SVG (not ▶ text) so the button's text is
                  exactly "Run all" and never collides with the per-box
                  "▶ Run" buttons the E2E suite counts. */}
              <svg viewBox="0 0 8 8" className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor" aria-hidden="true">
                <path d="M1 0.5 7 4 1 7.5z" />
              </svg>
              {runAllBusy ? "Running…" : "Run all"}
            </Button>

            <div className="h-6 w-px bg-white/15 mx-1.5" />
        </>

        {/* Account */}
        <Menu
          panelClassName="w-60"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className={
                "flex items-center gap-1 h-8 pl-1 pr-2 rounded-full border shadow-sm transition " +
                (open
                  ? "bg-white/15 border-white/30"
                  : "bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10")
              }
              title="Account"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-white text-slate-800 text-[10px] font-bold flex items-center justify-center">
                  {avatarInitials}
                </span>
              )}
              <span className="text-[10px] text-slate-400">▾</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <p className="text-[13px] font-medium text-slate-800 truncate">
                  {user.displayName || "Signed in"}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{user.email || "Workshop guest"}</p>
              </div>
              <div className="py-1">
                <MenuItem
                  icon="⏻"
                  label="Sign out"
                  danger
                  onClick={() => {
                    close();
                    onLogout();
                  }}
                />
              </div>
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}

export default memo(Header);
