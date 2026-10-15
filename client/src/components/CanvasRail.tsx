import { useBoardStore } from "../store/boardStore.js";
import { useUIStore } from "../store/uiStore.js";
import { AREA_COLORS } from "../types/index.js";

/**
 * Left canvas rail — the vertical tool strip from the reference design.
 *
 *   Add Box  — toggles the "Add a box" palette panel
 *   Area     — toggles the rectangle drawing tool (its color picker floats
 *              out to the right of the rail while the tool is active)
 *   Notes    — drops a collaboration Note on the canvas (with an undo toast)
 *   Help     — shows / hides the "How to use" card
 *
 * E2E markers: the rail's "Add Box" label is what `/Add Box/` finds on the
 * page, and the Area item's text is exactly `▭ Area` (icon span + a label
 * with a leading space) — keep both when restyling.
 */
export default function CanvasRail() {
  const paletteOpen = useUIStore((s) => s.paletteOpen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const areaTool = useUIStore((s) => s.areaTool);
  const areaColorIdx = useUIStore((s) => s.areaColorIdx);
  const togglePalette = useUIStore((s) => s.togglePalette);
  const toggleHelp = useUIStore((s) => s.toggleHelp);
  const toggleAreaTool = useUIStore((s) => s.toggleAreaTool);
  const setAreaColorIdx = useUIStore((s) => s.setAreaColorIdx);
  const showToast = useUIStore((s) => s.showToast);
  const addBox = useBoardStore((s) => s.addBox);
  const deleteBox = useBoardStore((s) => s.deleteBox);

  const addNote = () => {
    const id = addBox("note");
    showToast("Note added — drag it anywhere on the board.", () => deleteBox(id));
  };

  return (
    <div className="canvas-rail">
      <button
        onClick={togglePalette}
        className={"rail-btn rail-btn-primary" + (paletteOpen ? " rail-active" : "")}
        title="Show or hide the add-box panel"
      >
        <span className="rail-icon rail-icon-plus" aria-hidden>
          +
        </span>
        <span className="rail-label">Add Box</span>
      </button>

      <button
        onClick={toggleAreaTool}
        className={"rail-btn" + (areaTool ? " rail-active-indigo" : "")}
        title="Draw a rectangular area under the boxes"
      >
        <span className="rail-icon" aria-hidden>
          ▭
        </span>
        {/* Leading space keeps the button text `▭ Area` (E2E matches it). */}
        <span className="rail-label">{" Area"}</span>
      </button>

      <button onClick={addNote} className="rail-btn" title="Add a note for the team">
        <span className="rail-icon" aria-hidden>
          📝
        </span>
        <span className="rail-label">Notes</span>
      </button>

      <button
        onClick={toggleHelp}
        className={"rail-btn" + (helpOpen ? " rail-active" : "")}
        title="Show or hide the help card"
      >
        <span className="rail-icon" aria-hidden>
          ❔
        </span>
        <span className="rail-label">Help</span>
      </button>

      {/* Area color picker — floats beside the rail while the tool is active.
          Titles (`Draw color — <name>`) are what the E2E suite clicks. */}
      {areaTool && (
        <div className="area-colors">
          {AREA_COLORS.map((c, i) => (
            <button
              key={c.fill}
              onClick={() => setAreaColorIdx(i)}
              title={`Draw color — ${c.name}`}
              className={
                "area-color-swatch" + (i === areaColorIdx ? " area-color-active" : "")
              }
              style={{ backgroundColor: c.fill, borderColor: i === areaColorIdx ? c.border : undefined }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
