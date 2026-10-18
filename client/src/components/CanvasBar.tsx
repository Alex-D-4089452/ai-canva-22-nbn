import { useReactFlow, useStore } from "@xyflow/react";
import { useUIStore } from "../store/uiStore.js";

/**
 * Bottom-center canvas bar — the dark floating pill from the reference
 * design: zoom out / level / zoom in, then the transient toast area.
 *
 * The toast (uiStore) carries an optional single-step undo — e.g. the box
 * that was just added from the palette can be removed again without hunting
 * for it on the canvas. Replaces React Flow's default corner Controls.
 */
export default function CanvasBar() {
  const zoom = useStore((s) => s.transform[2]);
  const { zoomIn, zoomOut } = useReactFlow();
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);

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
