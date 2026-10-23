import { useState } from "react";
import { createPortal } from "react-dom";

interface GuestProfileModalProps {
  teamName: string;
  workshopName: string;
  defaultName?: string;
  defaultEmail?: string;
  onSave: (name: string, email: string) => Promise<void>;
}

/**
 * Post-join profile step for workshop guests: they picked a team by code —
 * now they choose a display name (required) and may leave an email (optional,
 * never used for login; it only lets facilitators share boards with them).
 */
export default function GuestProfileModal({
  teamName,
  workshopName,
  defaultName = "",
  defaultEmail = "",
  onSave,
}: GuestProfileModalProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please pick a name so your team can see who you are.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(name.trim(), email.trim());
    } catch (err: any) {
      setError(err?.message || "Could not save your profile — try again.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-2xl">
            🎉
          </div>
          <h2 className="text-lg font-bold text-slate-800">Welcome to {workshopName || "the workshop"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            You're joining <span className="font-semibold text-slate-700">{teamName || "your team"}</span>.
            Tell your teammates who you are.
          </p>
        </div>

        <div className="space-y-4 px-6 pb-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Your name</label>
            <input
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Email <span className="text-slate-400 font-normal">(optional — not used for login)</span>
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Leaving an email just makes it easier to share boards with you later.
            </p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? "Joining…" : "Join my team"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}