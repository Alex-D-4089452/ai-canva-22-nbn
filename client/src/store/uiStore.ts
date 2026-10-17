import { create } from "zustand";
import type { Point } from "../lib/placement.js";

/**
 * Canvas chrome UI state — the parts of the interface that are neither the
 * board itself (boardStore) nor auth/tokens: the add-box palette, the help
 * card, the Area drawing tool, the transient bottom-bar toast, and the reader
 * that tells `addBox` where the middle of the canvas currently is.
 *
 * Deliberately NOT persisted: these are per-session view toggles, and the
 * palette must come back open on reload (the E2E suite expects it).
 *
 * Nothing in App.tsx subscribes to this store — every consumer (Sidebar,
 * CanvasRail, CanvasBar, Toolbar, Canvas) subscribes itself, so a toast or a
 * panel toggle never re-renders the whole canvas tree.
 */
export interface CanvasToast {
  message: string;
  /** Optional single-step undo (e.g. remove the box that was just added). */
  undo?: () => void;
}

interface UIState {
  paletteOpen: boolean;
  helpOpen: boolean;
  areaTool: boolean;
  areaColorIdx: number;
  toast: CanvasToast | null;
  /**
   * Reader of the flow-space centre of the visible canvas, published by
   * Canvas so `boardStore.addBox` can drop new boxes in the middle of what the
   * user is looking at. It is a READER (a function, not a value) so
   * panning/zooming never re-renders this store's subscribers; null until the
   * canvas mounts.
   */
  readViewportCenter: (() => Point | null) | null;

  togglePalette: () => void;
  setPalette: (open: boolean) => void;
  toggleHelp: () => void;
  setHelp: (open: boolean) => void;
  toggleAreaTool: () => void;
  setAreaTool: (on: boolean) => void;
  setAreaColorIdx: (index: number) => void;
  showToast: (message: string, undo?: () => void) => void;
  hideToast: () => void;
  setViewportCenterReader: (read: (() => Point | null) | null) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function clearToastTimer() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

export const useUIStore = create<UIState>()((set) => ({
  paletteOpen: true,
  helpOpen: true,
  areaTool: false,
  areaColorIdx: 0,
  toast: null,
  readViewportCenter: null,

  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setPalette: (open) => set({ paletteOpen: open }),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
  setHelp: (open) => set({ helpOpen: open }),
  toggleAreaTool: () => set((s) => ({ areaTool: !s.areaTool })),
  setAreaTool: (on) => set({ areaTool: on }),
  setAreaColorIdx: (index) => set({ areaColorIdx: index }),

  showToast: (message, undo) => {
    clearToastTimer();
    toastTimer = setTimeout(() => {
      toastTimer = null;
      set({ toast: null });
    }, 6000);
    set({ toast: { message, undo } });
  },
  hideToast: () => {
    clearToastTimer();
    set({ toast: null });
  },

  setViewportCenterReader: (read) => set({ readViewportCenter: read }),
}));
