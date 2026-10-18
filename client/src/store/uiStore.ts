import { create } from "zustand";

/**
 * Canvas chrome UI state — the parts of the interface that are neither the
 * board itself (boardStore) nor auth/tokens: the add-box palette, the help
 * card, the Area drawing tool, and the transient bottom-bar toast.
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

  togglePalette: () => void;
  setPalette: (open: boolean) => void;
  toggleHelp: () => void;
  setHelp: (open: boolean) => void;
  toggleAreaTool: () => void;
  setAreaTool: (on: boolean) => void;
  setAreaColorIdx: (index: number) => void;
  showToast: (message: string, undo?: () => void) => void;
  hideToast: () => void;
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
}));
