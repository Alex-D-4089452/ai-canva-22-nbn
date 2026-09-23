import { memo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useBoardStore } from "../store/boardStore.js";
import { useTokenStore } from "../store/tokenStore.js";
import { Button } from "./ui/Button.js";
import { Menu, MenuDivider, MenuItem } from "./ui/Menu.js";
import PresenceRoster from "./PresenceRoster.js";
import {
  migrateBoardsFromCarbondocs,
  exportBoardsJson,
  parseBoardsExport,
  importBoards,
} from "../lib/migrate.js";

/**
 * Top app bar — the app's primary chrome.
 *
 * Decluttered from the original ~12 inline controls to a calm two-group bar:
 *   left  — brand, board title, save status
 *   right — collaboration (roster / Share), board actions (Boards menu),
 *           usage badge, role-gated views, account menu
 *
 * Rare + destructive actions (Clear / Delete board, Sign out) live inside
 * menus instead of the bar itself.
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
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
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
  sidebarOpen,
  onToggleSidebar,
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

  const saveLabel = SAVE_LABEL[saveStatus];
  const avatarInitials = (user.displayName || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <header className="app-bar flex items-center justify-between gap-3 px-4 h-14 relative z-20">
      {/* ---- Left: brand + board identity ---- */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="logo-tile" aria-hidden>
            🎨
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900 hidden sm:block">
            AI Canva
          </span>
        </div>

        <div className="h-6 w-px bg-slate-200 flex-shrink-0" />

        {currentBoardId ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <input
              type="text"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              placeholder="Untitled board"
              className="h-8 w-48 md:w-56 rounded-lg border border-transparent bg-slate-100/70 px-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
          <span className="text-xs text-slate-400">Opening board…</span>
        )}
      </div>

      {/* ---- Right: actions ---- */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Collaboration group */}
        {currentBoardId && (
          <>
            <PresenceRoster />
            <Button variant="primary" onClick={onShare} className="ml-1">
              👥 Share
            </Button>
            <div className="h-6 w-px bg-slate-200 mx-1.5" />
          </>
        )}

        {/* Board tools */}
        <Button onClick={onToggleSidebar} active={sidebarOpen} title="Toggle the add-box panel">
          {"+ Add Box"}
        </Button>

        <Menu
          panelClassName="w-72"
          trigger={({ open, toggle }) => (
            <Button
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

        <div className="h-6 w-px bg-slate-200 mx-1.5" />

        {/* Usage + role views + account */}
        <div
          className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-100/80 text-[11px] text-slate-500 tabular-nums"
          title={"Your total LLM tokens used: " + fmtTokens(totalTokens)}
        >
          ⚡ <span className="font-semibold text-slate-600">{fmtTokens(totalTokens)}</span>
          <span className="hidden md:inline">tok</span>
        </div>

        {isAdmin && (
          <Button
            variant="ghost"
            active={adminView}
            onClick={onToggleAdminView}
            title="Admin board — system stats and users"
          >
            🛠️ Admin
          </Button>
        )}
        {(isAdmin || isFacilitator) && (
          <Button
            variant="ghost"
            active={facilitatorView}
            onClick={onToggleFacilitatorView}
            title="Facilitator dashboard — templates, workshops, teams"
          >
            🧑‍🏫 Facilitator
          </Button>
        )}

        <Menu
          panelClassName="w-60"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className={
                "flex items-center gap-1 h-8 pl-1 pr-2 rounded-full border shadow-sm transition " +
                (open
                  ? "bg-slate-50 border-slate-300"
                  : "bg-white border-slate-200 hover:border-slate-300")
              }
              title="Account"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">
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