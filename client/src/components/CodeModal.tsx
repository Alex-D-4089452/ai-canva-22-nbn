import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import CodeEditor from "./CodeEditor.js";
import { wrapUIInHtml } from "../lib/code.js";
import type { BoxType } from "../types.js";

interface CodeModalProps {
  onClose: () => void;
  boxType: BoxType;
  code: string;
  onChange: (code: string) => void;
  title: string;
}

/**
 * Full-screen split view for a code box: editable code on the left, live
 * preview on the right. Rendered via a portal to document.body so it escapes
 * React Flow's transformed node container.
 */
export default function CodeModal({ onClose, boxType, code, onChange, title }: CodeModalProps) {
  const [previewLoading, setPreviewLoading] = useState(true);

  // Debounce the code fed to the preview: every keystroke changes `code`, and
  // rebuilding the iframe srcDoc per keystroke restarts the preview constantly
  // — it never settles. The editor stays live; the preview trails by ~400ms.
  const [previewCode, setPreviewCode] = useState(code);
  useEffect(() => {
    const t = setTimeout(() => setPreviewCode(code), 400);
    return () => clearTimeout(t);
  }, [code]);

  const srcDoc = boxType === "stitch" ? previewCode : wrapUIInHtml(previewCode);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span>⛶</span>
          <span>{title}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-white/20"
        >
          ✕ Close
        </button>
      </div>

      {/* Split view */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        {/* Code pane */}
        <div className="flex min-h-0 flex-col border-b border-white/10 md:border-b-0 md:border-r">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            📝 Code
          </div>
          <div className="min-h-0 flex-1 px-3 pb-3">
            <CodeEditor value={code} onChange={onChange} height="100%" />
          </div>
        </div>

        {/* Preview pane */}
        <div className="flex min-h-0 flex-col">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            👁 Preview
          </div>
          <div className="relative m-3 min-h-0 flex-1 overflow-hidden rounded-lg bg-white">
            {previewLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-slate-400">
                <span className="animate-spin text-2xl">⚙️</span>
                <span>Loading preview…</span>
              </div>
            )}
            <iframe
              srcDoc={srcDoc}
              onLoad={() => setPreviewLoading(false)}
              className="absolute inset-0 h-full w-full border-0"
              sandbox="allow-scripts allow-popups allow-forms allow-same-origin allow-modals"
              title="Preview"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
