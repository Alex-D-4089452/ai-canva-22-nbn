import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import Canvas from "./components/Canvas.js";
import Header from "./components/Header.js";
import Toolbar from "./components/Toolbar.js";
import Sidebar from "./components/Sidebar.js";
import NewBoardModal from "./components/NewBoardModal.js";
import ShareModal from "./components/ShareModal.js";
import LandingPage from "./components/landing/LandingPage.js";
import AdminBoard from "./components/AdminBoard.js";
import FacilitatorBoard from "./components/FacilitatorBoard.js";
import GuestProfileModal from "./components/GuestProfileModal.js";
import { isFacilitator } from "./lib/admin.js";
import { addBoardMember } from "./lib/firestore.js";
import { signInWithWorkshopCode } from "./lib/auth.js";
import { doc, getDoc, setDoc, getFirestore } from "firebase/firestore";
import { db } from "./lib/firebase.js";
import { useUserBoxesStore } from "./store/userBoxesStore.js";
import { useBoardStore } from "./store/boardStore.js";
import { useAuthStore } from "./store/authStore.js";
import { useTokenStore } from "./store/tokenStore.js";
import { signInWithGoogle, signOutUser } from "./lib/auth.js";
import { isAdmin, updateUserProfile, heartbeat } from "./lib/admin.js";
import { fetchUserTokenTotal } from "./lib/firestore.js";
import { BOX_TYPES } from "./types.js";
import type { BoxType } from "./types.js";

export default function App() {
  const addBox = useBoardStore((s) => s.addBox);
  const seedingRef = useRef(false);

  // Auth state
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  // Board state
  // NOTE: boardTitle / saveStatus / boardList are rendered by <Header>, which
  // subscribes to them itself — App must NOT subscribe, or every keystroke in
  // the board-title input would re-render the whole Canvas tree.
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const createNewBoard = useBoardStore((s) => s.createNewBoard);
  const loadBoardFromFirestore = useBoardStore((s) => s.loadBoardFromFirestore);
  const refreshBoardList = useBoardStore((s) => s.refreshBoardList);
  const deleteCurrentBoard = useBoardStore((s) => s.deleteCurrentBoard);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const unsubscribeFromBoard = useBoardStore((s) => s.unsubscribeFromBoard);
  const cleanupPresence = useBoardStore((s) => s.cleanupPresence);
  const subscribeToBoardUpdates = useBoardStore((s) => s.subscribeToBoardUpdates);

  const [isFacilitatorUser, setIsFacilitatorUser] = useState(false);
  const [facilitatorView, setFacilitatorView] = useState(false);
  // Guest workshop join: the pending team info awaiting profile completion.
  const [pendingJoin, setPendingJoin] = useState<{
    isNew: boolean;
    teamId: string;
    workshopId: string;
    teamName: string;
    workshopName: string;
    boardId: string;
  } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [adminView, setAdminView] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Initialize auth listener on mount
  useEffect(() => {
    const unsubscribe = useAuthStore.getState().init();
    return unsubscribe;
  }, []);

  // On login: record the user profile, check admin status, and start a
  // heartbeat so the admin board can show "active now" users.
  useEffect(() => {
    if (!user) {
      setIsAdminUser(false);
      setAdminView(false);
      useTokenStore.getState().reset();
      useUserBoxesStore.setState({ defs: [] });
      return;
    }
    useUserBoxesStore.getState().load();
    updateUserProfile(user).catch(() => {});
    isAdmin(user.uid).then(setIsAdminUser).catch(() => {});
    isFacilitator(user.uid).then(setIsFacilitatorUser).catch(() => {});
    // Seed the user's cumulative token count from Firestore.
    fetchUserTokenTotal(user.uid).then((n) => useTokenStore.getState().setTotal(n));
    const timer = setInterval(() => heartbeat(user).catch(() => {}), 60000);
    return () => clearInterval(timer);
  }, [user]);

  // Cleanup presence on page close
  useEffect(() => {
    const handler = () => cleanupPresence();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [cleanupPresence]);

  // Workshop guests returning with a complete profile skip the modal and land
  // directly on their team board (new guests get the modal via render below).
  useEffect(() => {
    if (!user || !pendingJoin || pendingJoin.isNew) return;
    const info = pendingJoin;
    const go = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const name = (snap.data()?.displayName as string) || "";
      if (name) {
        setPendingJoin(null);
        await loadBoardFromFirestore(info.boardId);
      }
      // else: keep pendingJoin so the modal renders for returning guests
      // that never finished their profile.
    };
    go();
  }, [user, pendingJoin, loadBoardFromFirestore]);

  // Auto-open the join modal when the URL carries ?code=XXXX.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get("code") || "").toUpperCase();
    if (/^[A-Z2-9]{8}$/.test(code)) {
      setJoinCode(code);
      setShowJoinModal(true);
    }
  }, []);

  // When user logs in, load the right board and set up real-time subscription.
  // ALWAYS calls loadBoardFromFirestore (which sets up onSnapshot) — even when
  // currentBoardId is already set from localStorage. Without this, the board
  // loads from localStorage but has no real-time listener.
  const initRef = useRef(false);
  useEffect(() => {
    if (!user || authLoading || initRef.current) return;
    initRef.current = true;
    const initBoard = async () => {
      // Read currentBoardId directly from the store (not from React closure)
      // to avoid stale closure issues with the persist middleware
      const storedBoardId = useBoardStore.getState().currentBoardId;
      // Check URL param first (shared links)
      const params = new URLSearchParams(window.location.search);
      const urlBoardId = params.get("board");
      // Always refresh the board list so the header count is correct on load,
      // regardless of whether a stored/URL board short-circuits below.
      await refreshBoardList();
      if (urlBoardId) {
        if (await loadBoardFromFirestore(urlBoardId)) return;
        // Unknown ?board= id — fall through to normal recovery.
      }
      // Board from localStorage — reload from Firestore to set up subscription.
      // loadBoardFromFirestore returns false when the id is dead (e.g. a
      // currentBoardId from a previous Firebase project); don't leave the
      // store pointed at a doc that doesn't exist (that caused endless
      // "Save failed").
      if (storedBoardId && (await loadBoardFromFirestore(storedBoardId))) {
        return;
      }
      // No usable board — recover the local canvas if the persist cache still
      // has boxes (dead id after a project switch), else load most recent or
      // create empty. Workshop guests (no auth email) skip auto-create: the
      // join flow loads their team board instead.
      if (!user.email) return;
      const boards = useBoardStore.getState().boardList;
      const localNodes = useBoardStore.getState().nodes;
      if (localNodes.length > 0) {
        // Keep what's on canvas: wrap it in a new board in THIS project.
        await createNewBoard(
          useBoardStore.getState().boardTitle || "Recovered Board",
          { preserveContent: true }
        );
      } else if (boards.length > 0) {
        await loadBoardFromFirestore(boards[0].id);
      } else {
        await createNewBoard("My First Board");
      }
    };
    initBoard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Auto-subscribe to board updates whenever currentBoardId changes.
  // This is the SINGLE source of truth for subscription management —
  // works for loadBoard, createNewBoard, and any other board switch.
  useEffect(() => {
    if (!user || !currentBoardId) return;
    subscribeToBoardUpdates();
    return () => unsubscribeFromBoard();
  }, [currentBoardId, user, subscribeToBoardUpdates, unsubscribeFromBoard]);

  // Seed a starter board on first load (localStorage mode only, when not logged in)
  useEffect(() => {
    if (seedingRef.current || authLoading || user) return;
    seedingRef.current = true;
    const state = useBoardStore.getState();
    if (state.nodes.length > 0) return;
    const ideaId = addBox("idea", { x: 80, y: 200 });
    useBoardStore.getState().updateBoxData(ideaId, {
      content: "An AI-powered meal planning app that creates weekly menus based on dietary preferences and grocery sales.",
    });
    const researchId = addBox("research", { x: 480, y: 200 });
    useBoardStore.getState().onConnect({
      source: ideaId, target: researchId,
      sourceHandle: null, targetHandle: null,
    } as any);
  }, [addBox, authLoading, user]);

  const handleAddBox = (type: BoxType) => { addBox(type); };

  // Stable callbacks for the memoized <Header> — recreated only when the
  // underlying store actions change (they never do).
  const handleClearBoard = useCallback(() => {
    if (!confirm("Clear the entire board? This removes all boxes.")) return;
    useBoardStore.setState({ nodes: [], edges: [], boxData: {} });
    clearBoard();
  }, [clearBoard]);

  const handleLogout = useCallback(async () => {
    unsubscribeFromBoard();
    await signOutUser();
  }, [unsubscribeFromBoard]);

  const handleNewBoard = useCallback(() => {
    setShowNewBoardModal(true);
  }, []);

  const handleCreateBoard = async (name: string) => {
    await createNewBoard(name);
    setShowNewBoardModal(false);
  };

  const handleLoadBoard = useCallback(async (boardId: string) => {
    await loadBoardFromFirestore(boardId);
  }, [loadBoardFromFirestore]);

  const handleDeleteBoard = useCallback(async () => {
    if (!confirm("Delete this board from the cloud? Local cache will remain.")) return;
    await deleteCurrentBoard();
  }, [deleteCurrentBoard]);

  const handleShare = useCallback(() => {
    setShowShareModal(true);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((o) => !o);
  }, []);

  const handleToggleAdminView = useCallback(() => {
    setFacilitatorView(false);
    setAdminView((v) => !v);
  }, []);

  const handleToggleFacilitatorView = useCallback(() => {
    setAdminView(false);
    setFacilitatorView((v) => !v);
  }, []);

  // === Render ===

  // Loading state
  if (authLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-spin">🎨</span>
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Workshop code join (guests): redeems the code via the join endpoint —
  // a Firebase custom token signs the guest in with a durable uid. The
  // profile modal then asks for a name before landing them on the team board.
  const handleJoinCode = async () => {
    if (joinCode.length !== 8) return;
    setJoining(true);
    setJoinError("");
    try {
      const info = await signInWithWorkshopCode(joinCode);
      setPendingJoin(info);
      // onAuthChange will flip `user` and render the app; the modal shows then.
    } catch (err: any) {
      setJoinError(err?.message || "Could not join — check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

  const saveGuestProfile = async (name: string, email: string) => {
    if (!user || !pendingJoin) return;
    await setDoc(
      doc(db, "users", user.uid),
      { displayName: name, email, guest: true, namePickedAt: Date.now() },
      { merge: true }
    );
    if (pendingJoin.boardId) {
      await addBoardMember(pendingJoin.boardId, user.uid, email || undefined).catch(() => {});
    }
    const info = pendingJoin;
    setPendingJoin(null);
    await loadBoardFromFirestore(info.boardId);
  };

  // Not logged in — show landing page with the workshop code entry.
  if (!user) {
    return (
      <div className="relative">
        <LandingPage />
        {/* Workshop guest join — no account needed, just a seat code. */}
        {!showJoinModal && (
          <button
            onClick={() => setShowJoinModal(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition"
          >
            🎟️ Have a workshop code?
          </button>
        )}
        {showJoinModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>🎟️</span> Join your workshop
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter the code your facilitator gave you — no account needed.
              </p>
              <input
                autoFocus
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="CODE"
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleJoinCode()}
              />
              {joinError && <p className="mt-2 text-xs text-red-600">{joinError}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setJoinError("");
                    setShowJoinModal(false);
                  }}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Sign in instead
                </button>
                <button
                  onClick={handleJoinCode}
                  disabled={joinCode.length !== 8 || joining}
                  className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  {joining ? "Joining…" : "Join"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Logged in — show the app
  return (
    <div className="flex flex-col h-full w-full">
      <Header
        user={user}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onShare={handleShare}
        onNewBoard={handleNewBoard}
        onLoadBoard={handleLoadBoard}
        onDeleteBoard={handleDeleteBoard}
        onClearBoard={handleClearBoard}
        onLogout={handleLogout}
        isAdmin={isAdminUser}
        isFacilitator={isFacilitatorUser}
        adminView={adminView}
        facilitatorView={facilitatorView}
        onToggleAdminView={handleToggleAdminView}
        onToggleFacilitatorView={handleToggleFacilitatorView}
      />

      <div className="flex-1 relative">
        {adminView ? (
          <AdminBoard user={user} onBack={() => setAdminView(false)} />
        ) : facilitatorView ? (
          <FacilitatorBoard
            user={user}
            onBack={() => setFacilitatorView(false)}
            onOpenBoard={(boardId) => {
              setFacilitatorView(false);
              loadBoardFromFirestore(boardId);
            }}
          />
        ) : (
          <ReactFlowProvider>
            <Canvas />
            <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
            <Toolbar />
          </ReactFlowProvider>
        )}
      </div>
      {/* Workshop guest profile step (new joins or unfinished profiles) */}
      {user && pendingJoin && (
        <GuestProfileModal
          teamName={pendingJoin.teamName}
          workshopName={pendingJoin.workshopName}
          onSave={saveGuestProfile}
        />
      )}
      <NewBoardModal
        open={showNewBoardModal}
        onClose={() => setShowNewBoardModal(false)}
        onCreate={handleCreateBoard}
      />
      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
}