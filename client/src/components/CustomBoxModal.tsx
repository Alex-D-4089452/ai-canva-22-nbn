import { useState } from "react";
import { createPortal } from "react-dom";
import {
  CUSTOM_BOX_COLORS,
  CUSTOM_BOX_EMOJIS,
  DEFAULT_CUSTOM_COLOR,
  DEFAULT_CUSTOM_ICON,
  validateCustomBoxDraft,
  type CustomBoxDraft,
} from "../lib/customBoxes.js";
import { useUserBoxesStore } from "../store/userBoxesStore.js";

/**
 * "Create Custom Box" dialog: names a reusable AI box template, picks an
 * emoji + color, and writes the prompt/systemPrompt templates. Saved to the
 * user's profile (users/{uid}/boxes) so it appears in their palette on every
 * board. Rendered via a portal to document.body.
 */
export default function CustomBoxModal({ onClose }: { onClose: () => void }) {
  const createDef = useUserBoxesStore((s) => s.create);

  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState(DEFAULT_CUSTOM_ICON);
  const [color, setColor] = useState(DEFAULT_CUSTOM_COLOR);
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const draft: CustomBoxDraft = { label, icon, color, description, prompt, systemPrompt };

  const handleSave = async () => {
    const problems = validateCustomBoxDraft(draft);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    try {
      await createDef(draft);
      onClose();
    } catch (err) {
      setErrors(["Could not save the box — check your connection and try again."]);
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>✨</span> Create a Custom Box
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <p className="text-xs text-slate-500 -mt-1">
            Your own reusable AI box — saved to your profile and available on every board.
          </p>

          {/* Name + icon */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Name</label>
              <input
                autoFocus
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
                placeholder="e.g. Translate to French"
                value={label}
                maxLength={40}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div
              className="w-11 h-11 rounded-xl border-2 flex items-center justify-center text-xl flex-shrink-0"
              style={{ borderColor: color, backgroundColor: color + "20" }}
              title="Preview"
            >
              {icon}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-1">
              {CUSTOM_BOX_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  className={
                    "w-8 h-8 rounded-lg text-base flex items-center justify-center border transition " +
                    (icon === e ? "border-indigo-500 bg-indigo-50 scale-110" : "border-slate-200 hover:bg-slate-50")
                  }
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_BOX_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={
                    "w-7 h-7 rounded-full border-2 transition " +
                    (color === c ? "border-slate-800 scale-110" : "border-white")
                  }
                  style={{ backgroundColor: c }}
                  title="Box color"
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
              placeholder="What does this box do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Prompt template */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Prompt template
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-300 min-h-[90px] resize-y"
              placeholder={"What the AI should do. Use connected inputs:\n\nTranslate the following to French:\n{{input_1}}"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Supports {"{{input_1}}"}, {"{{Box Name}}"}, {"{{inputs}}"} — just like the built-in boxes.
            </p>
          </div>

          {/* System prompt */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              System prompt <span className="text-slate-400">(the AI's role)</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-300 min-h-[60px] resize-y"
              placeholder="e.g. You are a professional translator. Reply only with the translation."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 space-y-0.5">
              {errors.map((e) => (
                <p key={e} className="text-xs text-red-600">• {e}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save to my profile"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}