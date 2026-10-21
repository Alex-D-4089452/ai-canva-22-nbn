import { useRef, useState } from "react";
import { useBoardStore } from "../store/boardStore.js";
import { useUIStore } from "../store/uiStore.js";
import { useUserBoxesStore } from "../store/userBoxesStore.js";
import { BOX_TYPES } from "../types/index.js";
import type { BoxType, BoxCategory, BoxRole } from "../types/index.js";
import CustomBoxModal from "./CustomBoxModal.js";

/**
 * "Add a box" palette — the white panel that slides out to the right of the
 * canvas rail (left edge of the screen, per the reference design).
 *
 * Rows show the box's name and a one-line description (the description rides
 * on a CSS ::after of the row's title span, and the trailing +/✓ indicator on
 * the row wrapper — neither is part of the button's textContent, which the
 * E2E suite relies on: palette buttons must end with the box label).
 *
 * Adding a box shows a transient "Added to the board" state on the row and a
 * bottom-bar toast with a single-step Undo.
 */

/**
 * Palette-only grouping. NBN boxes keep `category: "worker"` (they are normal
 * pipeline workers); `types` just lifts them into their own section below
 * Inputs, and `exclude` keeps them out of the general Workers section.
 */
const NBN_TYPES: BoxType[] = ["handoff", "alignment", "jargon"];

interface PaletteSection {
  title: string;
  category: BoxCategory;
  types?: BoxType[];
  exclude?: BoxType[];
}

const SECTIONS: PaletteSection[] = [
  { title: "Inputs", category: "input" },
  { title: "NBN", category: "worker", types: NBN_TYPES },
  { title: "Workers", category: "worker", exclude: NBN_TYPES },
  { title: "Collaboration", category: "collab" },
  { title: "Custom", category: "custom" },
];

/** Role filters shown as a dropdown at the top of the palette. */
const ROLE_STORAGE_KEY = "ai-canva:sidebar-role";

/** The selectable role profiles (must stay in sync with the <option> list). */
const ROLES: BoxRole[] = ["designer", "developer", "product"];

const ROLE_LABELS: Record<BoxRole, string> = {
  everyone: "Everyone",
  designer: "🎨 Designer",
  developer: "💻 Developer",
  product: "📊 Product",
};

/** First-word hints for the "next step" part of the add toast. */
const NEXT_HINT: Partial<Record<BoxCategory, string>> = {
  input: "Next: add some content, then connect it to a worker box.",
  worker: "Next: connect an input box to it, then press Run.",
  collab: "Next: drag it anywhere — the whole team sees it live.",
  custom: "Next: connect an input, then press Run.",
};

export default function Sidebar() {
  const addBox = useBoardStore((s) => s.addBox);
  const deleteBox = useBoardStore((s) => s.deleteBox);
  const addCustomBox = useBoardStore((s) => s.addCustomBox);
  const customDefs = useUserBoxesStore((s) => s.defs);
  const removeCustomDef = useUserBoxesStore((s) => s.remove);
  const paletteOpen = useUIStore((s) => s.paletteOpen);
  const togglePalette = useUIStore((s) => s.togglePalette);
  const showToast = useUIStore((s) => s.showToast);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [role, setRole] = useState<"all" | BoxRole>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(ROLE_STORAGE_KEY) : null;
    return ROLES.includes(stored as BoxRole) ? (stored as BoxRole) : "all";
  });

  const flashAdded = (key: string) => {
    setAddedKey(key);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedKey(null), 1600);
  };

  const handleAdd = (type: BoxType, label: string, category: BoxCategory) => {
    const id = addBox(type);
    flashAdded(type);
    showToast(`✓ ${label} added to the board. ${NEXT_HINT[category] || ""}`.trim(), () =>
      deleteBox(id)
    );
  };

  const handleAddCustom = (def: (typeof customDefs)[number]) => {
    const boxId = addCustomBox(def);
    flashAdded(def.id);
    showToast(`✓ ${def.label} added to the board. ${NEXT_HINT.custom}`, () => deleteBox(boxId));
  };

  const selectRole = (next: "all" | BoxRole) => {
    setRole(next);
    if (typeof localStorage !== "undefined") {
      if (next === "all") localStorage.removeItem(ROLE_STORAGE_KEY);
      else localStorage.setItem(ROLE_STORAGE_KEY, next);
    }
  };

  /** True when a box should appear under the active role filter.
   *  `everyone` boxes are shared scaffolding and show in every view. */
  const boxVisible = (meta: typeof BOX_TYPES[BoxType]) =>
    role === "all" || meta.roles.includes("everyone") || meta.roles.includes(role);

  const matchesQuery = (label: string, description: string) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return label.toLowerCase().includes(q) || description.toLowerCase().includes(q);
  };

  const boxesForSection = (section: PaletteSection) =>
    (Object.entries(BOX_TYPES) as [BoxType, typeof BOX_TYPES[BoxType]][])
      .filter(([type, meta]) => {
        if (section.types) return section.types.includes(type);
        if (section.exclude?.includes(type)) return false;
        return meta.category === section.category;
      })
      .filter(([, meta]) => boxVisible(meta) && matchesQuery(meta.label, meta.description));

  const visibleCustomDefs = customDefs.filter((def) =>
    matchesQuery(def.label, def.description || "")
  );

  const toggleSection = (title: string) =>
    setCollapsed((c) => ({ ...c, [title]: !c[title] }));

  const totalMatches =
    SECTIONS.reduce(
      (sum, s) =>
        sum +
        (s.category === "custom"
          ? visibleCustomDefs.length
          : boxesForSection(s).filter(([t]) => t !== "custom").length),
      0
    ) + 1; // the "New Custom Box" entry is always there

  const isSectionOpen = (title: string) => !query.trim() && !collapsed[title];

  return (
    <>
      {/* Sidebar panel — left edge, beside the rail */}
      <div
        className={
          "sidebar-panel " +
          (paletteOpen ? "translate-x-0" : "-translate-x-[calc(100%+4rem)]")
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-[15px] font-bold text-slate-800">Add a box</h2>
          <button
            onClick={togglePalette}
            className="w-8 h-8 -mr-1 text-slate-400 hover:text-slate-600 transition flex items-center justify-center rounded-lg hover:bg-slate-100"
            title="Hide panel"
          >
            ✕
          </button>
        </div>

        {/* Search + role filter */}
        <div className="px-3.5 pt-3 pb-2.5 space-y-2.5 border-b border-slate-100 flex-shrink-0">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
              Search boxes
            </span>
            <span className="relative block">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. brief, compare, upload"
                className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
              Show boxes for
            </span>
            <select
              value={role}
              onChange={(e) => selectRole(e.target.value as "all" | BoxRole)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
              title="Filter which boxes appear in the palette"
            >
              <option value="all">🧩 All boxes</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Scrollable palette */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {totalMatches === 0 && (
            <p className="text-[12px] text-slate-400 px-1 leading-snug">
              No boxes match “{query}”. Try another word.
            </p>
          )}
          {SECTIONS.map((section) => {
            // The static "custom" meta is a runtime fallback, never a
            // palette item — the Custom section lists the user's saved
            // definitions instead.
            const boxes = boxesForSection(section).filter(([t]) => t !== "custom");
            const isCustom = section.category === "custom";
            const defs = isCustom ? visibleCustomDefs : [];
            if (!isCustom && boxes.length === 0) return null;
            const open = isSectionOpen(section.title);
            const count = isCustom ? defs.length : boxes.length;
            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="palette-section"
                  title={open ? "Collapse this section" : "Expand this section"}
                >
                  <span>{section.title}</span>
                  <span className="palette-count">({count})</span>
                  <span
                    className={
                      "palette-chevron text-[9px] transition-transform " + (open ? "" : "-rotate-90")
                    }
                    aria-hidden
                  >
                    ▼
                  </span>
                </button>
                {open && (
                  <div className="space-y-1.5 mt-1.5">
                    {boxes.map(([type, meta]) => (
                      <div
                        key={type}
                        className={"palette-item" + (addedKey === type ? " is-added" : "")}
                      >
                        <button
                          onClick={() => handleAdd(type, meta.label, meta.category)}
                          className="palette-row"
                          title={meta.description}
                        >
                          <span
                            className="palette-tile"
                            style={{ backgroundColor: meta.color + "1F" }}
                          >
                            {meta.icon}
                          </span>
                          <span
                            className="palette-main"
                            data-desc={meta.description}
                            data-added="Added to the board"
                          >
                            <span className="palette-title">{meta.label}</span>
                          </span>
                        </button>
                      </div>
                    ))}
                    {isCustom && (
                      <>
                        {/* The user's saved custom box templates — click to add
                            an instance to the board; ✕ removes the template
                            (boxes already on boards are unaffected). */}
                        {defs.map((def) => (
                          <div
                            key={def.id}
                            className={
                              "palette-item palette-item-x" +
                              (addedKey === def.id ? " is-added" : "")
                            }
                          >
                            <button
                              onClick={() => handleAddCustom(def)}
                              className="palette-row"
                              title={def.description || "Add this custom box"}
                            >
                              <span
                                className="palette-tile"
                                style={{ backgroundColor: def.color + "1F" }}
                              >
                                {def.icon}
                              </span>
                              <span
                                className="palette-main"
                                data-desc={def.description || "Your custom AI box"}
                                data-added="Added to the board"
                              >
                                <span className="palette-title">{def.label}</span>
                              </span>
                            </button>
                            <button
                              onClick={() => removeCustomDef(def.id)}
                              className="touch-visible palette-remove"
                              title="Delete this template (boards keep their copies)"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {defs.length === 0 && !query.trim() && (
                          <p className="text-[11px] text-slate-400 px-1 leading-snug">
                            Create your own reusable AI boxes — saved to your profile.
                          </p>
                        )}
                        {(!query.trim() || "new custom box".includes(query.trim().toLowerCase())) && (
                          <button
                            onClick={() => setShowCustomModal(true)}
                            className="palette-cta"
                            title="Create a custom box"
                          >
                            <span className="palette-tile bg-indigo-100/70">✨</span>
                            <span className="palette-title text-indigo-700">New Custom Box</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Custom Box dialog */}
      {showCustomModal && <CustomBoxModal onClose={() => setShowCustomModal(false)} />}
    </>
  );
}
