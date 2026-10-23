import { useState, useEffect, useRef } from "react";
import { useBoardStore } from "../store/boardStore.js";
import { useAuthStore } from "../store/authStore.js";
import { copyToClipboard } from "../lib/code.js";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShareModal({ open, onClose }: ShareModalProps) {
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const collaborators = useBoardStore((s) => s.collaborators);
  const shareBoard = useBoardStore((s) => s.shareBoard);
  const unshareBoard = useBoardStore((s) => s.unshareBoard);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setCopied(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isOwner = user && currentBoardId;
  const shareLink = currentBoardId
    ? window.location.origin + "/?board=" + currentBoardId
    : "";

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    if (collaborators.includes(trimmed)) return;
    if (user?.email === trimmed) return;
    shareBoard([trimmed]);
    setEmail("");
  };

  const handleRemove = (emailToRemove: string) => {
    unshareBoard(emailToRemove);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareLink);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Share Board</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Share link */}
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1.5">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 bg-slate-50 focus:outline-hidden"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition whitespace-nowrap"
              >
                {copied ? "✅ Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Anyone with this link who is logged in and has access can view and edit.
            </p>
          </div>

          {/* Add collaborator */}
          {isOwner && (
            <form onSubmit={handleAdd}>
              <label className="text-sm font-medium text-slate-600 block mb-1.5">
                Add people by email
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </form>
          )}

          {/* Collaborator list */}
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1.5">
              People with access
            </label>
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
              {/* Owner */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center">
                    {(user?.email || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      {user?.email || "You"}
                    </div>
                    <div className="text-xs text-slate-400">Owner</div>
                  </div>
                </div>
              </div>
              {/* Collaborators */}
              {collaborators.map((emailAddr) => (
                <div key={emailAddr} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-400 text-white text-xs font-bold flex items-center justify-center">
                      {emailAddr.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{emailAddr}</div>
                      <div className="text-xs text-slate-400">Collaborator</div>
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleRemove(emailAddr)}
                      className="text-xs text-slate-400 hover:text-red-500 transition px-2 py-1 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {collaborators.length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-400">
                  No collaborators yet. Add people by email above.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
