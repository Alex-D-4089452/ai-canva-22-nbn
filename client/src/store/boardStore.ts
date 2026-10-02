import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type { BoxData, BoxType, BoxStatus, AgentStep, DeployInfo, ArtifactVersion, ChecklistItem } from "../types/index.js";
import { BOX_TYPES, AGENT_CONTROLLER_SYSTEM_PROMPT } from "../types/index.js";
import { generate, generateImage, generateStitchUI, publishSite } from "../lib/api.js";
import { fillPromptTemplate } from "../lib/prompts.js";
import { collectInputs } from "../lib/inputs.js";
import {
  MAX_AGENT_TURNS,
  MAX_PARSE_RETRIES,
  AGENT_OUTPUT_CLIP,
  buildBoardInventory,
  buildTurnPrompt,
  describeAction,
  nextAgentChildPosition,
  parseAgentAction,
  clip,
} from "../lib/agent.js";
import { appendVersion, buildCodeChangePrompt, extractCode, isCompletePrototype } from "../lib/code.js";
import {
  deployBlockedReason,
  deployFilesFor,
  deploySiteTitle,
  validateDeploySet,
} from "../lib/deploy.js";
import { parseSlidesResponse } from "../lib/slides.js";
import { cleanBoxDataForFirestore } from "../lib/serialization.js";
import { DEFAULT_TIMER_MS } from "../lib/timer.js";
import type { CustomBoxDef } from "../lib/customBoxes.js";
import {
  saveBoard, loadBoard, listBoards, listSharedBoards, deleteBoard,
  subscribeToBoard, subscribeToPresence, updatePresence, removePresence,
  shareBoard as fsShareBoard, unshareBoard as fsUnshareBoard,
  updateBoardData,
  recordTokenUsage,
  type BoardDoc,
} from "../lib/firestore.js";
import type { PresenceUser } from "../types/index.js";
import { useAuthStore } from "./authStore.js";
import { getUserEmail } from "../lib/admin.js";
import { useTokenStore } from "./tokenStore.js";

function makeId(): string {
  return `box-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Debounced save to Firestore — triggers 1s after the last change
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    useBoardStore.getState().saveToFirestore();
  }, 1000);
}

// === Collaboration helpers ===

const CURSOR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6"];

function getInitials(email: string): string {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getColorForEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// Track last local save time to prevent onSnapshot echo
let lastSaveTime = 0;
let lastSavedUpdatedAt = 0;

// Throttle presence updates to max 1 write per 200ms
let presenceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPresence: { x: number; y: number } | null = null;
// Presence heartbeat: keeps lastActive fresh every 15s so users who are on
// the board but not moving their mouse stay listed as online (the roster
// filters out entries stale for >30s).
let presenceHeartbeat: ReturnType<typeof setInterval> | null = null;

// Subscription cleanup functions
let boardUnsub: (() => void) | null = null;
let presenceUnsub: (() => void) | null = null;

// Agent runs that a user asked to stop — checked between agent turns (the
// current LLM call/run always finishes; the loop halts before the next one).
const agentCancelled = new Set<string>();

// collectInputs lives in lib/inputs.ts (pure, unit-tested) — image-only
// sources contribute a named input so text prompts see them.

/** A deploy record with every field defined (Firestore rejects `undefined`). */
function emptyDeployInfo(): DeployInfo {
  return {
    slug: "",
    url: "",
    versionId: "",
    claimToken: "",
    claimUrl: "",
    anonymous: true,
    expiresAt: "",
    deployedAt: 0,
    fileCount: 0,
    bytes: 0,
    warnings: [],
    error: "",
  };
}

/** Box types whose output is code a change request can be applied to. */
function isCodeBoxType(type: BoxType | string): boolean {
  return type === "ui";
}

function defaultBoxData(type: BoxType): BoxData {
  const meta = BOX_TYPES[type];
  return {
    content: "",
    prompt: meta.defaultPrompt,
    systemPrompt: meta.defaultSystemPrompt,
    output: "",
    status: "idle" as BoxStatus,
    imageData: undefined,
    outputImage: undefined,
    documents: undefined,
    ...(type === "timer"
      ? { timerDurationMs: DEFAULT_TIMER_MS, timerStatus: "idle" as const }
      : null),
    // Checklist boxes: the shared task array is created EMPTY but DEFINED
    // (Firestore-safe, and the panel can rely on it existing).
    ...(type === "checklist" ? { checklistItems: [] } : null),
    // Handoff Brief boxes: editable role fields + generation timestamp.
    ...(type === "handoff"
      ? { handoffFrom: "", handoffTo: "", handoffGeneratedAt: undefined }
      : null),
    // Alignment Check boxes: run timestamp.
    ...(type === "alignment"
      ? { alignmentRanAt: undefined }
      : null),
    // Decision Log boxes: decision count.
    ...(type === "decision" ? { decisionCount: 0 } : null),
  };
}

interface BoardState {
  nodes: Node[];
  edges: Edge[];
  boxData: Record<string, BoxData>;

  // Board management (Firestore)
  currentBoardId: string | null;
  boardTitle: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  boardList: BoardDoc[];
  collaborators: string[];
  activeUsers: PresenceUser[];

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addBox: (
    type: BoxType,
    position?: { x: number; y: number }
  ) => string;
  updateBoxData: (id: string, patch: Partial<BoxData>) => void;
  addArea: (rect: { x: number; y: number; width: number; height: number }, fill: string, border: string) => string;
  addCustomBox: (def: CustomBoxDef, position?: { x: number; y: number }) => string;
  setAreaColor: (id: string, fill: string, border: string) => void;
  setBoxName: (id: string, name: string) => void;
  deleteBox: (id: string) => void;
  runBox: (id: string) => Promise<void>;
  /** Programmatic edge creation — used by the Agent box to wire the boxes it
   *  makes. Dedupes and rejects self-connections like a manual connect. */
  connectBoxes: (sourceId: string, targetId: string) => boolean;
  /** Ask a running Agent box to stop after its current turn. */
  stopAgent: (id: string) => void;
  /**
   * Checklist box (collab): replace the shared task list. Every mutation is a
   * pure function in `lib/checklist.ts` (add/parse, toggle with attribution,
   * assign, rename, reorder, clear done) — the store only stores the result,
   * so the whole list syncs to collaborators through the normal board save.
   */
  setChecklistItems: (id: string, items: ChecklistItem[]) => void;

  /**
   * Publish this box's code to a live here.now URL (UI Design and Stitch UI
   * boxes). The first call creates the Site; later calls update the
   * same one, sending its version back so a Site someone else changed is refused
   * rather than clobbered. The claim token (anonymous Sites) is kept on the box,
   * because here.now returns it only once.
   */
  deployBox: (id: string) => Promise<void>;
  /**
   * UI Design box: apply an AI change request to the code already in the box.
   * The reply replaces `code` but is appended as a new version first, so the
   * previous code is always recoverable.
   */
  applyChangeRequest: (id: string) => Promise<void>;
  /** UI Design box: restore a previous code version (appended, never deleted). */
  revertCodeVersion: (id: string, version: number) => void;

  setBoxStatus: (id: string, status: BoxStatus, error?: string) => void;

  // Board operations (Firestore)
  createNewBoard: (title?: string, opts?: { preserveContent?: boolean }) => Promise<void>;
  /** Returns true when the board was found and applied; false if the id is dead. */
  loadBoardFromFirestore: (boardId: string) => Promise<boolean>;
  saveToFirestore: () => Promise<void>;
  setBoardTitle: (title: string) => void;
  refreshBoardList: () => Promise<void>;
  deleteCurrentBoard: () => Promise<void>;
  clearBoard: () => void;

  // Collaboration
  subscribeToBoardUpdates: () => void;
  unsubscribeFromBoard: () => void;
  shareBoard: (emails: string[]) => Promise<void>;
  unshareBoard: (email: string) => Promise<void>;
  updateCursorPosition: (x: number, y: number) => void;
  cleanupPresence: () => void;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      boxData: {},
      currentBoardId: null,
      boardTitle: "Untitled Board",
      saveStatus: "idle",
      boardList: [],
      collaborators: [],
      activeUsers: [],

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
        scheduleSave();
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
        scheduleSave();
      },

      onConnect: (connection) => {
        set({
          edges: rfAddEdge(
            { ...connection, animated: true },
            get().edges
          ),
        });
        scheduleSave();
      },

      addBox: (type, position) => {
        const id = makeId();
        const meta = BOX_TYPES[type];
        const node: Node = {
          id,
          type,
          position: position || {
            x: 200 + Math.random() * 200,
            y: 150 + Math.random() * 100,
          },
          data: {
            boxType: type,
            title: `${meta.label} Box`,
          },
          style: { width: meta.defaultWidth, height: meta.defaultHeight },
        };

        set({
          nodes: [...get().nodes, node],
          boxData: {
            ...get().boxData,
            [id]: {
              ...defaultBoxData(type),
              // Notes are a communication tool — attribute them to their
              // author (set once at creation, shown under the note text).
              ...(type === "note"
                ? {
                    authorEmail: useAuthStore.getState().user?.email || "",
                    authorName:
                      useAuthStore.getState().user?.displayName ||
                      useAuthStore.getState().user?.email ||
                      "Someone",
                  }
                : null),
            },
          },
        });

        scheduleSave();
        return id;
      },

      // === Areas (drawn rectangles under the boxes) ===

      addArea: (rect, fill, border) => {
        const id = makeId().replace("box-", "area-");
        const node: Node = {
          id,
          type: "area",
          position: { x: rect.x, y: rect.y },
          style: { width: rect.width, height: rect.height },
          // Areas render BELOW all boxes (default node z is 0; React Flow
          // elevates the selected node by 1000 so a selected area's color
          // dots stay reachable even where boxes overlap it).
          zIndex: -1,
          data: { fill, border },
        };
        set({ nodes: [...get().nodes, node] });
        scheduleSave();
        return id;
      },

      setAreaColor: (id, fill, border) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, fill, border } } : n
          ),
        });
        scheduleSave();
      },

      // Custom box: instantiate a saved template as a `custom`-type AI box.
      // The definition's prompt/systemPrompt/icon/color are COPIED onto the
      // instance, so boards stay self-contained and deleting the saved
      // definition later never affects boxes already on boards.
      addCustomBox: (def, position) => {
        const id = makeId();
        const meta = BOX_TYPES.custom;
        const node: Node = {
          id,
          type: "custom",
          position: position || {
            x: 200 + Math.random() * 200,
            y: 150 + Math.random() * 100,
          },
          data: {
            boxType: "custom",
            title: def.label + " Box",
            customLabel: def.label,
            customIcon: def.icon,
            customColor: def.color,
          },
          style: { width: meta.defaultWidth, height: meta.defaultHeight },
        };
        set({
          nodes: [...get().nodes, node],
          boxData: {
            ...get().boxData,
            [id]: {
              content: "",
              prompt: def.prompt,
              systemPrompt: def.systemPrompt,
              output: "",
              status: "idle" as BoxStatus,
              imageData: undefined,
              outputImage: undefined,
            },
          },
        });
        scheduleSave();
        return id;
      },

      updateBoxData: (id, patch) => {
        const current = get().boxData[id];
        if (!current) return;
        set({
          boxData: {
            ...get().boxData,
            [id]: { ...current, ...patch },
          },
        });
        scheduleSave();
      },

      setBoxName: (id, name) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, title: name } } : n
          ),
        });
        scheduleSave();
      },

      deleteBox: (id) => {
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter(
            (e) => e.source !== id && e.target !== id
          ),
          boxData: Object.fromEntries(
            Object.entries(get().boxData).filter(([k]) => k !== id)
          ),
        });
        scheduleSave();
      },

      setBoxStatus: (id, status, error) => {
        get().updateBoxData(id, { status, error });
      },

      applyChangeRequest: async (id) => {
        const data = get().boxData[id];
        const node = get().nodes.find((n) => n.id === id);
        if (!data || !node) return;
        if (data.status === "running") return;
        const boxType = (node.data.boxType || node.type) as BoxType;
        if (!isCodeBoxType(boxType)) return;

        const current = data.code || "";
        if (!current.trim()) {
          get().setBoxStatus(id, "error", "Generate the code first — then you can request changes to it.");
          return;
        }

        // Upstream boxes may carry the request (e.g. a Review box's findings).
        const { namedInputs } = collectInputs(get().nodes, get().edges, get().boxData, id, { skipSelf: true });
        const typed = (data.changePrompt || "").trim();
        const upstream = namedInputs.map((i) => (i.output || "").trim()).filter(Boolean).join("\n\n");
        const request = typed || upstream;
        if (!request) {
          get().setBoxStatus(
            id,
            "error",
            "Say what to change (the “Request a change” field), or connect a box that says it."
          );
          return;
        }

        get().setBoxStatus(id, "running");
        try {
          const userPrompt = buildCodeChangePrompt({
            code: current,
            request,
            context: typed ? namedInputs : [],
          });
          const result = await generateTextForBox(id, {
            systemPrompt: data.systemPrompt,
            userPrompt,
            boxType,
          });

          const next = extractCode(result.content || "");
          if (!isCompletePrototype(next)) {
            get().setBoxStatus(
              id,
              "error",
              "The change returned incomplete code (no App component / render call), so the existing code was kept. Try rephrasing the change."
            );
            return;
          }
          if (next === current) {
            get().updateBoxData(id, {
              status: "done",
              error: undefined,
              // Keep the request in the field so it can be tweaked and retried.
              codeVersions: data.codeVersions || [],
            });
            return;
          }

          const versions = appendVersion(data.codeVersions, {
            content: next,
            createdBy: actorName(),
            source: "generated",
            note: request.length > 200 ? request.slice(0, 200) + "…" : request,
          });
          get().updateBoxData(id, {
            code: next,
            output: result.content,
            status: "done",
            error: undefined,
            codeVersions: versions,
            codeVersion: versions[versions.length - 1].version,
            changePrompt: "",
          });
        } catch (err: any) {
          get().setBoxStatus(id, "error", err.message || "Could not apply the change");
        }
      },

      deployBox: async (id) => {
        const data = get().boxData[id];
        const node = get().nodes.find((n) => n.id === id);
        if (!data || !node) return;
        if (data.status === "running") return;
        const boxType = (node.data.boxType || node.type) as BoxType;

        const blocked = deployBlockedReason(boxType, data);
        if (blocked) {
          get().setBoxStatus(id, "error", blocked);
          return;
        }
        const files = deployFilesFor(boxType, data);
        const invalid = validateDeploySet(files);
        if (invalid) {
          get().setBoxStatus(id, "error", invalid);
          return;
        }

        const previous = data.deploy;
        get().setBoxStatus(id, "running");
        try {
          const title = deploySiteTitle(
            boxType,
            data,
            (node.data?.title as string) || "",
            get().boardTitle || ""
          );
          const result = await publishSite({
            files,
            displayName: title.displayName,
            displayDescription: title.displayDescription,
            // Redeploy the SAME Site when we already made one. The version goes
            // back so here.now refuses the update if the live Site moved on.
            ...(previous?.slug
              ? {
                  slug: previous.slug,
                  baseVersionId: previous.versionId || undefined,
                  claimToken: previous.claimToken || undefined,
                }
              : null),
          });

          get().updateBoxData(id, {
            status: "done",
            error: undefined,
            deploy: {
              slug: result.slug || previous?.slug || "",
              url: result.siteUrl || previous?.url || "",
              versionId: result.versionId || "",
              // here.now returns the claim token exactly once: keep the old one if
              // an update response did not repeat it.
              claimToken: result.claimToken || previous?.claimToken || "",
              claimUrl: result.claimUrl || previous?.claimUrl || "",
              anonymous: result.anonymous !== false,
              expiresAt: result.expiresAt || previous?.expiresAt || "",
              deployedAt: Date.now(),
              fileCount: result.fileCount || files.length,
              bytes: result.bytes || 0,
              warnings: Array.isArray(result.warnings) ? result.warnings : [],
              error: "",
            },
          });
        } catch (err: any) {
          const message = err?.message || "Could not publish the site";
          get().updateBoxData(id, {
            status: "error",
            error: message,
            deploy: {
              ...(previous || emptyDeployInfo()),
              deployedAt: previous?.deployedAt || 0,
              error: message,
            },
          });
        }
      },

      revertCodeVersion: (id, version) => {
        const data = get().boxData[id];
        if (!data) return;
        const target = (data.codeVersions || []).find((v) => v.version === version);
        if (!target) return;
        // History is append-only: a revert is itself a new version.
        const versions = appendVersion(data.codeVersions, {
          content: target.content,
          createdBy: actorName(),
          source: "edited",
          note: `reverted to v${version}`,
        });
        get().updateBoxData(id, {
          code: target.content,
          status: "done",
          error: undefined,
          codeVersions: versions,
          codeVersion: versions[versions.length - 1].version,
        });
      },

      connectBoxes: (sourceId, targetId) => {
        if (!sourceId || !targetId || sourceId === targetId) return false;
        const edges = get().edges;
        const exists = edges.some(
          (e) => e.source === sourceId && e.target === targetId
        );
        if (exists) return false;
        set({
          edges: rfAddEdge(
            {
              source: sourceId,
              target: targetId,
              sourceHandle: null,
              targetHandle: null,
              animated: true,
            } as Connection,
            edges
          ),
        });
        scheduleSave();
        return true;
      },

      stopAgent: (id) => {
        if (get().boxData[id]?.status !== "running") {
          agentCancelled.delete(id);
          return;
        }
        agentCancelled.add(id);
        // Immediate feedback: the loop halts after the current turn
        // (LLM call / box run in flight always completes).
        const existing = get().boxData[id]?.agentSteps || [];
        get().updateBoxData(id, {
          agentSteps: [
            ...existing,
            {
              id: makeId(),
              at: Date.now(),
              type: "stopped" as const,
              label: "Stop requested — halting after the current step…",
            },
          ],
        });
      },

      // Checklist box (collab): the store only persists the result of the pure
      // mutations in lib/checklist.ts. A no-op edit returns the same array, so
      // that write never happens.
      setChecklistItems: (id, items) => {
        const data = get().boxData[id];
        if (!data) return;
        // The pure mutators keep the reference of every task they did not
        // touch, so an all-identical list means "nothing changed" — skip the
        // write entirely rather than re-saving the same board.
        const prev = data.checklistItems || [];
        if (prev.length === items.length && prev.every((it, i) => it === items[i])) return;
        get().updateBoxData(id, { checklistItems: items });
      },

      // --- Firestore board operations ---

      createNewBoard: async (title, opts) => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        const boardId = makeId();
        const now = Date.now();
        const state = get();
        // Default: a brand-new empty board. preserveContent keeps the current
        // canvas (recovery when a stored currentBoardId no longer exists —
        // e.g. after a Firebase project switch).
        const keep = opts?.preserveContent === true;
        await saveBoard({
          id: boardId,
          title: title || "Untitled Board",
          ownerId: user.uid,
          ownerEmail: user.email || "",
          collaborators: [],
          nodes: keep ? state.nodes : [],
          edges: keep ? state.edges : [],
          boxData: keep ? state.boxData : {},
          createdAt: now, updatedAt: now,
        });
        set({
          currentBoardId: boardId,
          boardTitle: title || "Untitled Board",
          collaborators: [],
          ...(keep ? null : { nodes: [], edges: [], boxData: {} }),
          saveStatus: "saved",
        });
        get().refreshBoardList();
      },

      loadBoardFromFirestore: async (boardId) => {
        const board = await loadBoard(boardId);
        if (!board) {
          // Dead id (deleted board, or localStorage pointing at another
          // Firebase project). Drop it so scheduleSave/updateDoc stop failing
          // forever — keep the local canvas so content isn't wiped.
          console.warn("[load] Board not found in this project:", boardId);
          set({ currentBoardId: null, saveStatus: "idle" });
          return false;
        }
        console.log("[load] Board collaborators from Firestore:", board.collaborators);
        set({
          currentBoardId: board.id,
          boardTitle: board.title,
          collaborators: board.collaborators || [],
          nodes: board.nodes as Node[],
          edges: board.edges as Edge[],
          boxData: board.boxData as Record<string, BoxData>,
          saveStatus: "saved",
          activeUsers: [],
        });
        // Subscription is handled automatically by the useEffect in App.tsx
        // that watches currentBoardId — no need to manually subscribe here
        return true;
      },

      saveToFirestore: async () => {
        const state = get();
        const user = useAuthStore.getState().user;
        if (!user || !state.currentBoardId) return;
        set({ saveStatus: "saving" });
        lastSaveTime = Date.now();
        lastSavedUpdatedAt = Date.now();
        console.log("[save] email:", user.email, "| uid:", user.uid, "| boardId:", state.currentBoardId);
        console.log("[save] collaborators in store:", state.collaborators);
        try {
          // Strip undefined values and base64 imageData from boxData.
          // updateDoc rejects undefined values, so we must remove them entirely.
          // imageData (base64) is also removed to stay under Firestore's 1MB limit.
          const cleanBoxData = cleanBoxDataForFirestore(state.boxData);
          // Use updateBoardData (not saveBoard) so we do NOT overwrite
          // ownerId/ownerEmail/createdAt — collaborators can save without claiming ownership
          // Only save board CONTENT — do NOT include collaborators.
          // Collaborators are managed by shareBoard/unshareBoard (arrayUnion/arrayRemove).
          // Including collaborators here could overwrite the real list and break access.
          const saveTimestamp = Date.now();
          await updateBoardData(state.currentBoardId, {
            title: state.boardTitle,
            nodes: state.nodes,
            edges: state.edges,
            boxData: cleanBoxData,
            updatedAt: saveTimestamp,
          });
          lastSavedUpdatedAt = saveTimestamp;
          console.log("[save] SUCCESS | updatedAt:", saveTimestamp, "| user:", user.email);
          set({ saveStatus: "saved" });
        } catch (err: any) {
          // updateDoc on a missing doc (project switch / deleted board):
          // recreate the document with the full payload instead of failing forever.
          const missing =
            err?.code === "not-found" ||
            /No document to update|NOT_FOUND|not exist/i.test(String(err?.message || ""));
          if (missing && state.currentBoardId) {
            try {
              const cleanBoxData = cleanBoxDataForFirestore(state.boxData);
              const saveTimestamp = Date.now();
              await saveBoard({
                id: state.currentBoardId,
                title: state.boardTitle,
                ownerId: user.uid,
                ownerEmail: user.email || "",
                collaborators: state.collaborators || [],
                nodes: state.nodes,
                edges: state.edges,
                boxData: cleanBoxData,
                createdAt: saveTimestamp,
                updatedAt: saveTimestamp,
              });
              lastSavedUpdatedAt = saveTimestamp;
              console.log("[save] RECREATED missing board doc", state.currentBoardId);
              set({ saveStatus: "saved" });
              return;
            } catch (err2) {
              console.error("Firestore save (recreate) failed:", err2);
              set({ saveStatus: "error" });
              return;
            }
          }
          console.error("Firestore save failed:", err);
          set({ saveStatus: "error" });
        }
      },

      setBoardTitle: (title) => {
        set({ boardTitle: title });
        scheduleSave();
      },

      refreshBoardList: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        try {
          // Guests (workshop code users) have no auth email — fall back to
          // their profile email from users/{uid} so email-shared boards still
          // appear for them.
          const email = user.email || (await getUserEmail(user.uid));
          const [owned, shared] = await Promise.all([
            listBoards(user.uid),
            email || user.uid ? listSharedBoards(email, user.uid) : Promise.resolve([]),
          ]);
          // Merge, deduplicate by id, sort by updatedAt desc
          const seen = new Set<string>();
          const all = [...owned, ...shared].filter((b) => {
            if (seen.has(b.id)) return false;
            seen.add(b.id);
            return true;
          });
          set({ boardList: all.sort((a, b) => b.updatedAt - a.updatedAt) });
        } catch (err) {
          console.error("Failed to list boards:", err);
        }
      },

      deleteCurrentBoard: async () => {
        const state = get();
        if (!state.currentBoardId) return;
        try {
          await deleteBoard(state.currentBoardId);
          set({
            currentBoardId: null,
            boardTitle: "Untitled Board",
            nodes: [], edges: [], boxData: {},
            saveStatus: "idle",
          });
          get().refreshBoardList();
        } catch (err) {
          console.error("Failed to delete board:", err);
        }
      },

      clearBoard: () => {
        get().unsubscribeFromBoard();
        set({
          nodes: [], edges: [], boxData: {},
          currentBoardId: null,
          boardTitle: "Untitled Board",
          collaborators: [],
          activeUsers: [],
        });
      },

      // === Collaboration actions ===

      subscribeToBoardUpdates: () => {
        const state = get();
        if (!state.currentBoardId) return;
        const boardId = state.currentBoardId;
        console.log("[store] Subscribing to board updates:", boardId);

        // Subscribe to board document changes (real-time sync)
        boardUnsub = subscribeToBoard(boardId, (board) => {
          // Echo prevention: compare the snapshot's updatedAt with our last saved updatedAt.
          // If they match, this is our own save echoing back — skip it.
          // If they differ, it's another user's update — apply it.
          const isEcho = board.updatedAt === lastSavedUpdatedAt;
          console.log("[sync] onSnapshot | board.updatedAt:", board.updatedAt, "| myLastSaved:", lastSavedUpdatedAt, "| isEcho:", isEcho, "| me:", useAuthStore.getState().user?.email);
          if (isEcho) return;
          console.log("[sync] Applying remote update | nodes:", board.nodes?.length, "| edges:", board.edges?.length);
          set({
            nodes: board.nodes as Node[],
            edges: board.edges as Edge[],
            boxData: board.boxData as Record<string, BoxData>,
            boardTitle: board.title,
            collaborators: board.collaborators || [],
          });
        });

        // Subscribe to presence (live cursors)
        presenceUnsub = subscribeToPresence(boardId, (users) => {
          set({ activeUsers: users });
        });

        // Presence heartbeat: even without mouse movement, refresh
        // lastActive every 15s so the online roster stays accurate.
        if (presenceHeartbeat) clearInterval(presenceHeartbeat);
        presenceHeartbeat = setInterval(async () => {
          const user = useAuthStore.getState().user;
          const bid = get().currentBoardId;
          if (!user || !bid) return;
          try {
            await updatePresence(bid, user.uid, {
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email || "",
              initials: getInitials(user.email || user.uid),
              color: getColorForEmail(user.email || user.uid),
              ...(pendingPresence || {}), // keep the last known cursor, if any
            });
          } catch {
            // best-effort
          }
        }, 15000);
      },

      unsubscribeFromBoard: () => {
        if (boardUnsub) { boardUnsub(); boardUnsub = null; }
        if (presenceUnsub) { presenceUnsub(); presenceUnsub = null; }
        if (presenceHeartbeat) { clearInterval(presenceHeartbeat); presenceHeartbeat = null; }
        get().cleanupPresence();
        set({ activeUsers: [] });
      },

      shareBoard: async (emails) => {
        const state = get();
        if (!state.currentBoardId) return;
        const user = useAuthStore.getState().user;
        if (!user) return;
        try {
          await fsShareBoard(state.currentBoardId, emails);
          set({ collaborators: [...get().collaborators, ...emails] });
        } catch (err) {
          console.error("Failed to share board:", err);
        }
      },

      unshareBoard: async (email) => {
        const state = get();
        if (!state.currentBoardId) return;
        try {
          await fsUnshareBoard(state.currentBoardId, email);
          set({ collaborators: get().collaborators.filter((e) => e !== email) });
        } catch (err) {
          console.error("Failed to unshare:", err);
        }
      },

      updateCursorPosition: (x, y) => {
        const state = get();
        if (!state.currentBoardId) return;
        const user = useAuthStore.getState().user;
        if (!user) return;

        pendingPresence = { x, y };
        if (presenceTimer) return; // already scheduled

        presenceTimer = setTimeout(async () => {
          presenceTimer = null;
          if (!pendingPresence) return;
          const { x, y } = pendingPresence;
          pendingPresence = null;
          const boardId = get().currentBoardId;
          if (!boardId) return;
          try {
            await updatePresence(boardId, user.uid, {
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email || "",
              initials: getInitials(user.email || user.uid),
              color: getColorForEmail(user.email || user.uid),
              cursorX: x,
              cursorY: y,
            });
          } catch {
            // ignore — presence is best-effort
          }
        }, 200);
      },

      cleanupPresence: () => {
        const state = get();
        const user = useAuthStore.getState().user;
        if (!state.currentBoardId || !user) return;
        if (presenceTimer) { clearTimeout(presenceTimer); presenceTimer = null; }
        removePresence(state.currentBoardId, user.uid).catch(() => {});
      },

      runBox: async (id) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === id);
        const data = state.boxData[id];

        if (!node || !data) return;
        if (data.status === "running") return;

        const boxType = (node.data.boxType || node.type) as BoxType;

        // Collaboration boxes (note / label / timer / checklist) have no AI to
        // run — the Run button is hidden for them. Guard here too so no future
        // caller falls into the text-AI branch.
        if (
          boxType === "note" ||
          boxType === "label" ||
          boxType === "timer" ||
          boxType === "checklist"
        ) {
          return;
        }

        // The Agent box runs its own multi-turn loop (create/connect/run
        // boxes on the board) — it manages its own status and inputs.
        if (boxType === "agent") {
          await runAgentLoop(id);
          return;
        }

        // Gather upstream inputs
        const { namedInputs, inputImage } = collectInputs(
          state.nodes,
          state.edges,
          state.boxData,
          id
        );

        // Set running state
        get().setBoxStatus(id, "running");

        try {
          if (boxType === "cartoon") {
            // Image generation via fal.ai. The source image travels as
            // imageUrl — drop image-only named inputs so the prompt is style
            // text, not "[image: <url>]".
            const textInputs = namedInputs.filter(
              (i) => !/^\[image(\s|:)/.test(i.output)
            );
            let prompt = data.prompt;
            if (textInputs.length > 0) {
              prompt = fillPromptTemplate(data.prompt, textInputs);
            }

            const result = await generateImage({
              prompt,
              imageUrl: inputImage,
            });

            if (result.error) throw new Error(result.error);

            get().updateBoxData(id, {
              outputImage: result.imageUrl,
              status: "done",
              error: undefined,
            });
          } else if (boxType === "stitch") {
            // UI generation via Google Stitch
            let prompt = data.prompt;
            if (namedInputs.length > 0) {
              prompt = fillPromptTemplate(data.prompt, namedInputs);
            }
            const result = await generateStitchUI(prompt);
            if (result.error) throw new Error(result.error);
            get().updateBoxData(id, {
              output: result.html,
              code: result.html,
              status: "done",
              error: undefined,
            });
          } else {
            // Text generation via the Ollama backend (research, summarise,
            // slides, custom boxes)
            const filledPrompt = fillPromptTemplate(
              data.prompt,
              namedInputs
            );

            const result = await generateTextForBox(id, {
              systemPrompt: data.systemPrompt,
              userPrompt: filledPrompt,
              boxType,
            });

            if (boxType === "slides") {
              // Parse the LLM's JSON output into a slide deck
              const slides = parseSlidesResponse(result.content);
              get().updateBoxData(id, {
                output: result.content,
                slides,
                status: "done",
                error: undefined,
              });
            } else if (boxType === "ui") {
              // Extract component code from the LLM's response
              const code = extractCode(result.content);
              // Validate: the code must be a complete, mountable component
              if (!isCompletePrototype(code)) {
                throw new Error(
                  "Generated code is incomplete (missing the App component or the ReactDOM render call). Try simplifying the requirements or re-run."
                );
              }
              // Every build is versioned, so an AI change (or a revert) always has
              // something to fall back to.
              const versions = appendVersion(data.codeVersions, {
                content: code,
                createdBy: actorName(),
                source: "generated",
                note: "initial build",
              });
              get().updateBoxData(id, {
                output: result.content,
                code,
                status: "done",
                error: undefined,
                codeVersions: versions,
                codeVersion: versions[versions.length - 1].version,
              });
            } else {
              // Store text output (research, summarise, handoff, etc.)
              get().updateBoxData(id, {
                output: result.content,
                status: "done",
                error: undefined,
                ...(boxType === "handoff" ? { handoffGeneratedAt: Date.now() } : null),
                ...(boxType === "alignment" ? { alignmentRanAt: Date.now() } : null),
                ...(boxType === "decision"
                  ? {
                      decisionCount: (result.content.match(/^\d+\.\s/gm) || []).length,
                    }
                  : null),
              });
            }
          }
        } catch (err: any) {
          get().setBoxStatus(id, "error", err.message || "Generation failed");
        }
      },
    }),
    {
      name: "ai-canva-board",
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        boxData: state.boxData,
        currentBoardId: state.currentBoardId,
        boardTitle: state.boardTitle,
      }),
    }
  )
);

/** Display name used for attributions (approvals, edits, rejections). */
function actorName(): string {
  const user = useAuthStore.getState().user;
  return user?.displayName || user?.email || "Someone";
}

/**
 * One text generation for a box: calls the model, records token usage (box
 * display + Firestore ledger + session total) and throws on failure. Shared by
 * the generic text branch and the AI change-request branch so the accounting
 * can never drift apart.
 */
async function generateTextForBox(
  id: string,
  opts: { systemPrompt: string; userPrompt: string; boxType: BoxType }
) {
  const result = await generate({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
  });

  if (result.error) throw new Error(result.error);

  const store = useBoardStore.getState();
  if (result.usage) {
    store.updateBoxData(id, { tokens: result.usage });
    const user = useAuthStore.getState().user;
    if (user) {
      recordTokenUsage(
        user.uid,
        store.currentBoardId || "",
        id,
        opts.boxType,
        result.usage,
        result.model
      );
      useTokenStore.getState().addTokens(result.usage.totalTokens);
    }
  }

  return result;
}

// ============================================================
// Agent box — a multi-turn autonomous loop driven by the LLM.
//
// The board is the agent's toolbox: each turn the model returns ONE JSON
// action (add_box / connect / run_box / finish) which is executed against
// the board with the regular store actions. Created boxes are normal boxes —
// the user can watch the agent build a pipeline live, stop it, and take the
// boxes over afterwards. Everything is client-side: no backend changes.
// ============================================================

/**
 * Resolves an agent reference (a ref like "r1" the agent coined for boxes
 * it created this run, or the title of a board box) to a node id.
 */
function resolveAgentBoxRef(key: string, refs: Record<string, string>): string | null {
  const k = key.trim().toLowerCase();
  if (!k) return null;
  if (refs[k]) return refs[k];
  const match = useBoardStore
    .getState()
    .nodes.find((n) => {
      if (n.type === "area") return false;
      const title = ((n.data?.title as string) || "").trim().toLowerCase();
      return title === k;
    });
  return match?.id ?? null;
}

async function runAgentLoop(agentId: string) {
  const get = () => useBoardStore.getState();

  const startNode = get().nodes.find((n) => n.id === agentId);
  const startData = get().boxData[agentId];
  if (!startNode || !startData) return;
  if (startData.status === "running") return;

  const task = (startData.content || "").trim();
  if (!task) {
    get().setBoxStatus(
      agentId,
      "error",
      "Give the agent a task first — type it in the box, then run again."
    );
    return;
  }

  /** Appends one step to the agent's persisted transcript. */
  const pushStep = (step: Omit<AgentStep, "id" | "at">) => {
    const existing = get().boxData[agentId]?.agentSteps || [];
    get().updateBoxData(agentId, {
      agentSteps: [...existing, { id: makeId(), at: Date.now(), ...step }],
    });
  };

  // Fresh transcript + status for each run.
  get().updateBoxData(agentId, {
    status: "running",
    error: undefined,
    output: "",
    tokens: undefined,
    agentSteps: [],
  });

  const steps: string[] = []; // human-readable lines fed back each turn
  const refs: Record<string, string> = {}; // ref (lowercased) → box id
  let refSeq = 0;
  let childSeq = 0;
  let parseFailures = 0;
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let lastResult = "(This is the start of the run — take your first action.)";

  try {
    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      // Cooperative stop: checked before every turn — an in-flight LLM call
      // or box run always completes first.
      if (agentCancelled.has(agentId)) {
        pushStep({ type: "stopped", label: "Stopped — the agent ended the run here." });
        get().updateBoxData(agentId, {
          status: "done",
          error: undefined,
          output:
            get().boxData[agentId]?.output ||
            "Stopped before finishing. The boxes created so far are still on the board — run the agent again to continue.",
        });
        return;
      }

      // Re-read state every turn: the board may have changed (remotely too).
      const data = get().boxData[agentId];
      const node = get().nodes.find((n) => n.id === agentId);
      if (!data || !node) return;

      // The final turn forces a wrap-up instead of another board action.
      const isWrapUp = turn === MAX_AGENT_TURNS - 1;

      const { namedInputs } = collectInputs(
        get().nodes,
        get().edges,
        get().boxData,
        agentId,
        { skipSelf: true } // the task itself is already the "Task" section
      );
      const refLabels = Object.entries(refs).map(([ref, id]) => {
        const n = get().nodes.find((x) => x.id === id);
        return [ref, `"${(n?.data?.title as string) || id}" (${n?.type})`] as [string, string];
      });

      const res = await generate({
        systemPrompt: data.systemPrompt || AGENT_CONTROLLER_SYSTEM_PROMPT,
        userPrompt: buildTurnPrompt({
          task,
          guidance: data.prompt || undefined,
          inputs: namedInputs,
          inventory: buildBoardInventory(get().nodes, get().edges, get().boxData),
          refs: Object.fromEntries(refLabels),
          steps,
          lastResult,
          wrapUp: isWrapUp,
        }),
      });

      // Token accounting — same ledger as every other box, cumulative here.
      if (res.usage) {
        usage.promptTokens += res.usage.promptTokens;
        usage.completionTokens += res.usage.completionTokens;
        usage.totalTokens += res.usage.totalTokens;
        get().updateBoxData(agentId, { tokens: { ...usage } });
        const user = useAuthStore.getState().user;
        if (user) {
          recordTokenUsage(
            user.uid,
            get().currentBoardId || "",
            agentId,
            "agent",
            res.usage
          );
          useTokenStore.getState().addTokens(res.usage.totalTokens);
        }
      }
      if (res.error) throw new Error(res.error);

      const parsed = parseAgentAction(res.content);

      // Unparseable reply — coach the model and retry; after too many
      // consecutive failures, salvage the run with what we have.
      if (!parsed.ok) {
        if (isWrapUp || parseFailures >= MAX_PARSE_RETRIES) {
          const fallback =
            (res.content || "").trim() ||
            "The agent could not complete its task (kept replying outside the action protocol).";
          pushStep({
            type: "error",
            label: "Gave up on protocol replies — kept the last reply as the answer.",
            detail: clip(res.content, 200),
          });
          get().updateBoxData(agentId, { status: "done", error: undefined, output: fallback });
          return;
        }
        parseFailures += 1;
        pushStep({
          type: "error",
          label: "Reply was not one valid JSON action — retrying.",
          detail: clip(res.content, 200),
        });
        lastResult = `Your last reply was DISCARDED: ${parsed.error} Reply with exactly ONE JSON object (no prose, no markdown).`;
        continue;
      }
      parseFailures = 0;
      const action = parsed.action;

      // ---- add_box ----
      if (action.action === "add_box") {
        const agentNode = get().nodes.find((n) => n.id === agentId);
        const agentStyle = agentNode?.style;
        const agentWidth =
          typeof agentStyle?.width === "number"
            ? agentStyle.width
            : BOX_TYPES.agent.defaultWidth;
        const pos = nextAgentChildPosition(
          agentNode?.position || { x: 100, y: 100 },
          agentWidth,
          childSeq++
        );
        const newId = get().addBox(action.boxType, pos);
        let ref = action.ref;
        if (!ref || refs[ref]) ref = `r${++refSeq}`;
        refs[ref.toLowerCase()] = newId;

        const title = action.title || BOX_TYPES[action.boxType].label + " Box";
        get().setBoxName(newId, title);
        const patch: Partial<BoxData> = {};
        if (action.prompt) patch.prompt = action.prompt;
        if (action.content) {
          patch.content = action.content;
          // Idea boxes are pure content — make their text flow downstream.
          if (action.boxType === "idea") patch.output = action.content;
        }
        if (Object.keys(patch).length > 0) get().updateBoxData(newId, patch);

        pushStep({ type: "add_box", label: describeAction(action) + ` · ref ${ref}`, boxId: newId });
        steps.push(`${describeAction(action)} (ref ${ref}) — ok`);
        lastResult = `Created ${ref} → "${title}" (${action.boxType}).${
          action.prompt ? " Its prompt was set." : ""
        } Connect it or run it when ready.`;
        continue;
      }

      // ---- connect ----
      if (action.action === "connect") {
        const fromId = resolveAgentBoxRef(action.from, refs);
        const toId = resolveAgentBoxRef(action.to, refs);
        const describe = describeAction(action);
        const typeOf = (id: string | null) => {
          if (!id) return "";
          return (
            (useBoardStore.getState().nodes.find((n) => n.id === id)?.type as string) || ""
          );
        };
        if (!fromId || !toId) {
          pushStep({ type: "error", label: describe, detail: "Could not resolve one of the boxes." });
          lastResult = `Connection failed — "${action.from}" or "${action.to}" did not match any box. Use a ref you created or an exact board box title.`;
          continue;
        }
        if (fromId === toId || fromId === agentId || toId === agentId || typeOf(fromId) === "agent" || typeOf(toId) === "agent") {
          pushStep({ type: "error", label: describe, detail: "Agent boxes cannot be wired into pipelines." });
          lastResult = "Connection rejected: never connect or run agent boxes. Pick your created boxes or ordinary board boxes.";
          continue;
        }
        const added = get().connectBoxes(fromId, toId);
        pushStep({
          type: "connect",
          label: describe + (added ? "" : " (already connected)"),
        });
        steps.push(describe + (added ? " — ok" : " — already existed"));
        lastResult = added
          ? "Wired. Note: a box pulls its upstream input when IT runs, so run upstream boxes first."
          : "Those two boxes were already connected.";
        continue;
      }

      // ---- run_box ----
      if (action.action === "run_box") {
        const describe = describeAction(action);
        const boxId = resolveAgentBoxRef(action.box, refs);
        if (!boxId) {
          pushStep({ type: "error", label: describe, detail: "No box matches this ref or title." });
          lastResult = `"${action.box}" matched no box. Use one of your refs or an exact board box title.`;
          continue;
        }
        const state = get();
        const targetNode = state.nodes.find((n) => n.id === boxId);
        const bd = state.boxData[boxId];
        if (!targetNode || !bd) {
          pushStep({ type: "error", label: describe, detail: "That box no longer exists." });
          lastResult = `The box "${action.box}" was deleted — drop it from your plan.`;
          continue;
        }
        if (targetNode.type === "agent") {
          pushStep({ type: "error", label: describe, detail: "An agent cannot run itself or another agent." });
          lastResult = "Never run agent boxes. Run one of your created/ordinary boxes or call finish.";
          continue;
        }
        // Already-done boxes are reused, not re-run (cheap + idempotent).
        const existingOut = bd.output || bd.content || (bd.outputImage ? "(image)" : "");
        if (bd.status === "done" && existingOut) {
          pushStep({ type: "run", label: describe + " — already done, reused its output", boxId });
          steps.push(describe + " — already done");
          lastResult = `Box "${targetNode.data?.title}" already ran. Output:\n"""\n${clip(existingOut, AGENT_OUTPUT_CLIP)}\n"""`;
          continue;
        }

        pushStep({ type: "run", label: describe + "…", boxId });
        await get().runBox(boxId);
        const after = get().boxData[boxId];
        const title = (targetNode.data?.title as string) || action.box;
        if (!after) {
          pushStep({ type: "error", label: describe, detail: "That box was deleted while running." });
          lastResult = `The box "${title}" was deleted — adjust your plan.`;
          continue;
        }
        if (after.status === "error") {
          pushStep({ type: "run", label: describe + " — failed", detail: after.error, boxId });
          steps.push(`${describe} — failed`);
          lastResult = `Box "${title}" FAILED: ${after.error || "unknown error"}. You can add a replacement box with a simpler prompt, or finish explaining what happened.`;
          continue;
        }
        const out = after.output || after.content || (after.outputImage ? "(generated an image)" : "");
        pushStep({
          type: "run",
          label: describe + ` — done (${(after.output || "").length} chars)`,
          boxId,
        });
        steps.push(`${describe} — ok`);
        lastResult = `Output of "${title}":\n"""\n${clip(out, AGENT_OUTPUT_CLIP)}\n"""`;
        continue;
      }

      // ---- finish ----
      pushStep({ type: "finish", label: "Task complete ✓" });
      get().updateBoxData(agentId, {
        status: "done",
        error: undefined,
        output:
          action.answer?.trim() ||
          "The agent finished. See the step log below for what it created and ran on the board.",
      });
      return;
    }

    // Loop exhausted without finish — close the run gracefully (the wrap-up
    // turn usually prevents this; this is the safety net).
    get().updateBoxData(agentId, {
      status: "done",
      error: undefined,
      output:
        get().boxData[agentId]?.output ||
        "The agent reached its step budget before finishing. The boxes it created are still on the board — you can run them yourself or re-run the agent.",
    });
  } catch (err: any) {
    const message = err?.message || "Agent run failed";
    pushStep({ type: "error", label: "Run failed", detail: message });
    get().setBoxStatus(agentId, "error", message);
  } finally {
    agentCancelled.delete(agentId);
  }
}