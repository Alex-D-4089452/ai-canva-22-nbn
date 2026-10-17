import { useEffect } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { useBoardStore } from "../store/boardStore.js";
import { useUIStore } from "../store/uiStore.js";

/** Selectors for everything that lives in an editable field — there the
 *  browser's own text undo must keep working. */
const EDITABLE = "input, textarea, select, [contenteditable='true'], .cm-editor";

/**
 * Bottom-center canvas bar — the dark floating pill from the reference
 * design: zoom out / level / zoom in, undo / redo, then the transient toast
 * area.
 *
 * The undo/redo buttons mirror the Ctrl/Cmd+Z and Ctrl+Shift+Z (Ctrl+Y)
 * shortcuts, which are handled here too so the history controls and their keys
 * live in one place. Both read the store's derived `canUndo`/`canRedo` flags;
 * the key handler goes through `getState()`, so a keystroke never re-renders
 * this bar.
 *
 * The toast (uiStore) keeps its own optional single-step undo — e.g. the box
 * that was just added from the palette can be removed again without hunting
 * for it on the canvas. Replaces React Flow's default corner Controls.
 */
export default function CanvasBar() {
  const zoom = useStore((s) => s.transform[2]);
  const { zoomIn, zoomOut } = useReactFlow();
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);
  const canUndo = useBoardStore((s) => s.canUndo);
  const canRedo = useBoardStore((s) => s.canRedo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = (e.key || "").toLowerCase();
      const redo = key === "y" || (key === "z" && e.shiftKey);
      const undo = key === "z" && !e.shiftKey;
      if (!undo && !redo) return;
      // Typing in a field? Leave it to the browser's own text undo.
      const target = e.target as HTMLElement | null;
      if (target?.closest(EDITABLE)) return;
      if (e.defaultPrevented) return;
      const changed = undo
        ? useBoardStore.getState().undo()
        : useBoardStore.getState().redo();
      if (changed) {
        e.preventDefault();
        hideToast(); // the toast's own action may no longer be the last step
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hideToast]);

  const runUndo = () => {
    if (useBoardStore.getState().undo()) hideToast();
  };
  const runRedo = () => {
    if (useBoardStore.getState().redo()) hideToast();
  };

  return (
    <div className="canvas-bar">
      <button className="bar-zoom-btn" onClick={() => zoomOut()} title="Zoom out">
        −
      </button>
      <span className="bar-zoom-level" title="Canvas zoom level">
        {Math.round(zoom * 100)}%
      </span>
      <button className="bar-zoom-btn" onClick={() => zoomIn()} title="Zoom in">
        +
      </button>

      <span className="bar-divider" aria-hidden />
      <button
        className="bar-zoom-btn bar-history-btn"
        onClick={runUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        ↶
      </button>
      <button
        className="bar-zoom-btn bar-history-btn"
        onClick={runRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        ↷
      </button>

      {toast && (
        <>
          <span className="bar-divider" aria-hidden />
          <span className="bar-toast">{toast.message}</span>
          {toast.undo && (
            <button
              className="bar-undo"
              onClick={() => {
                toast.undo!();
                hideToast();
              }}
              title="Undo the last action"
            >
              Undo
            </button>
          )}
        </>
      )}
    </div>
  );
}
