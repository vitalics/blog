"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { createKeybindManager } from "@/lib/keybind";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Download,
  Upload,
  Trash2,
  Plus,
  ChevronDown,
  Pencil,
  Check,
  X,
  PenLine,
  Save,
  MoreHorizontal,
  Share2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
  id: string;
  name: string;
  updatedAt: number;
  // biome-ignore lint/suspicious/noExplicitAny: excalidraw internal types not publicly exported
  elements: any[];
  // biome-ignore lint/suspicious/noExplicitAny: excalidraw internal types not publicly exported
  appState: any;
  // biome-ignore lint/suspicious/noExplicitAny: excalidraw internal types not publicly exported
  files: Record<string, any>;
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

const IDB_DB = "excalidraw-editor";
const IDB_VER = 3;
const IDB_SESSIONS = "sessions";
const IDB_LIBRARY = "library";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, IDB_VER);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // v1 store — drop legacy single-scene store
      if (db.objectStoreNames.contains("scenes")) db.deleteObjectStore("scenes");
      if (!db.objectStoreNames.contains(IDB_SESSIONS))
        db.createObjectStore(IDB_SESSIONS, { keyPath: "id" });
      // v3 — shared library store
      if (!db.objectStoreNames.contains(IDB_LIBRARY))
        db.createObjectStore(IDB_LIBRARY);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(): Promise<Session[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SESSIONS, "readonly");
    const req = tx.objectStore(IDB_SESSIONS).getAll();
    req.onsuccess = () => resolve((req.result as Session[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(session: Session): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SESSIONS, "readwrite");
    tx.objectStore(IDB_SESSIONS).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGet(id: string): Promise<Session | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SESSIONS, "readonly");
    const req = tx.objectStore(IDB_SESSIONS).get(id);
    req.onsuccess = () => resolve(req.result as Session | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SESSIONS, "readwrite");
    tx.objectStore(IDB_SESSIONS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const LIBRARY_KEY = "singleton";

// biome-ignore lint/suspicious/noExplicitAny: excalidraw library item types not publicly exported
async function dbGetLibrary(): Promise<any[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_LIBRARY, "readonly");
    const req = tx.objectStore(IDB_LIBRARY).get(LIBRARY_KEY);
    req.onsuccess = () => resolve((req.result as any[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

// biome-ignore lint/suspicious/noExplicitAny: excalidraw library item types not publicly exported
async function dbPutLibrary(items: any[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_LIBRARY, "readwrite");
    tx.objectStore(IDB_LIBRARY).put(items, LIBRARY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function newSession(name = "Untitled"): Session {
  return { id: uid(), name, updatedAt: Date.now(), elements: [], appState: {}, files: {} };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExcalidrawEditor({ initialHash = "" }: { initialHash?: string }) {
  const { resolvedTheme } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  // biome-ignore lint/suspicious/noExplicitAny: excalidraw library item types not publicly exported
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const libraryItemsRef = useRef<any[]>([]);
  useEffect(() => { libraryItemsRef.current = libraryItems; }, [libraryItems]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomInput, setZoomInput] = useState("100");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ref so auto-save closure always has the latest id without re-subscribing
  const currentIdRef = useRef(currentId);
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);

  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => { excalidrawAPIRef.current = excalidrawAPI; }, [excalidrawAPI]);

  // Sync zoom display whenever Excalidraw's viewport changes
  useEffect(() => {
    if (!excalidrawAPI) return;
    // biome-ignore lint/suspicious/noExplicitAny: zoom type not publicly exported
    const unsub = excalidrawAPI.onScrollChange((_x, _y, zoom: any) => {
      const pct = Math.round((zoom?.value ?? 1) * 100);
      setZoomLevel(pct);
      setZoomInput(String(pct));
    });
    return () => unsub();
  }, [excalidrawAPI]);

  const excalidrawContainerRef = useRef<HTMLDivElement>(null);

  // Ref tracking whether we've already handled the #addLibrary hash this mount
  const libraryImportHandledRef = useRef(false);
  // Set to true after a #addLibrary import completes; cleared once pushed to the API
  const libraryNeedsFlushRef = useRef(false);
  // Hash passed from the wrapper, captured before the dynamic import resolved
  const capturedHashRef = useRef(initialHash);

  // ---------------------------------------------------------------------------
  // Bootstrap: load all sessions, pick the most-recently-updated one
  // ---------------------------------------------------------------------------
  useEffect(() => {
    dbGetAll().then((all) => {
      if (all.length === 0) {
        const s = newSession();
        setSessions([s]);
        setCurrentId(s.id);
        setNameInput(s.name);
        dbPut(s).catch(() => {});
      } else {
        const sorted = [...all].sort((a, b) => b.updatedAt - a.updatedAt);
        setSessions(sorted);
        setCurrentId(sorted[0].id);
        setNameInput(sorted[0].name);
      }
    }).catch(() => {});

    dbGetLibrary().then((items) => {
      if (items.length > 0) setLibraryItems(items);
    }).catch(() => {}).finally(() => {
      setLibraryLoaded(true);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Handle #addLibrary=<url> redirect from libraries.excalidraw.com
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!libraryLoaded || libraryImportHandledRef.current) return;

    const hash = capturedHashRef.current;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const libUrl = params.get("addLibrary");
    if (!libUrl) return;

    libraryImportHandledRef.current = true;
    // Remove hash from URL without triggering navigation
    history.replaceState(null, "", window.location.pathname + window.location.search);

    fetch(libUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch library: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // biome-ignore lint/suspicious/noExplicitAny: excalidraw library format
        const incoming: any[] = data?.library ?? data?.libraryItems ?? [];
        if (incoming.length === 0) return;

        // Merge by id — skip items already in the library
        const existing = libraryItemsRef.current;
        // biome-ignore lint/suspicious/noExplicitAny: excalidraw library item types not publicly exported
        const existingIds = new Set(existing.map((item: any) => item.id));
        // biome-ignore lint/suspicious/noExplicitAny: excalidraw library item types not publicly exported
        const fresh = incoming.filter((item: any) => !existingIds.has(item.id));
        if (fresh.length === 0) return;

        const merged = [...existing, ...fresh];
        setLibraryItems(merged);
        dbPutLibrary(merged).catch(() => {});
        libraryNeedsFlushRef.current = true;

        // Push to the live Excalidraw instance if ready; otherwise the flush effect
        // will pick it up once excalidrawAPI becomes available after remount
        const api = excalidrawAPIRef.current;
        if (api) {
          api.updateLibrary({ libraryItems: merged, merge: false });
          libraryNeedsFlushRef.current = false;
        }
      })
      .catch(() => {
        // Silently ignore fetch/parse errors
      });
  }, [libraryLoaded]);

  // ---------------------------------------------------------------------------
  // Flush pending library import once excalidrawAPI becomes available
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!excalidrawAPI || !libraryNeedsFlushRef.current) return;
    const items = libraryItemsRef.current;
    if (items.length === 0) return;
    excalidrawAPI.updateLibrary({ libraryItems: items, merge: false });
    libraryNeedsFlushRef.current = false;
  }, [excalidrawAPI]);

  // ---------------------------------------------------------------------------
  // Load session into canvas whenever currentId changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!excalidrawAPI || !currentId) return;
    // Read from IDB so we always get the latest persisted state,
    // even if React hasn't committed the setSessions update yet.
    dbGet(currentId).then((session) => {
      if (!session) return;
      excalidrawAPI.updateScene({
        elements: session.elements,
        // biome-ignore lint/suspicious/noExplicitAny: restoring persisted appState
        appState: session.appState as any,
      });
      if (session.files && Object.keys(session.files).length > 0) {
        // biome-ignore lint/suspicious/noExplicitAny: restoring persisted files
        excalidrawAPI.addFiles(Object.values(session.files) as any);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excalidrawAPI, currentId]);

  // ---------------------------------------------------------------------------
  // Periodic auto-save every 30 seconds
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      const id = currentIdRef.current;
      if (!id) return;
      const session = sessionsRef.current.find((s) => s.id === id);
      if (session) dbPut(session).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-save current session with debounce
  // ---------------------------------------------------------------------------
  // biome-ignore lint/suspicious/noExplicitAny: excalidraw onChange passes internal types
  const handleChange = useCallback((elements: any, appState: any, files: any) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const id = currentIdRef.current;
      if (!id) return;
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, elements, appState, files, updatedAt: Date.now() } : s,
        );
        const session = updated.find((s) => s.id === id);
        if (session) dbPut(session).catch(() => {});
        return updated;
      });
    }, 1000);
  }, []);

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  const switchSession = useCallback((id: string) => {
    if (id === currentIdRef.current) { setDropdownOpen(false); return; }

    // Flush pending debounce and synchronously snapshot current canvas state
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const api = excalidrawAPIRef.current;
    if (api) {
      const currentId = currentIdRef.current;
      const elements = api.getSceneElements();
      const files = api.getFiles();
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === currentId ? { ...s, elements: [...elements], files, updatedAt: Date.now() } : s,
        );
        const session = updated.find((s) => s.id === currentId);
        if (session) dbPut(session).catch(() => {});
        return updated;
      });
    }

    const session = sessionsRef.current.find((s) => s.id === id);
    if (!session) return;
    setCurrentId(id);
    setNameInput(session.name);
    setDropdownOpen(false);
  }, []);

  const createSession = useCallback(() => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    dbPut(s).catch(() => {});
    setCurrentId(s.id);
    setNameInput(s.name);
    setDropdownOpen(false);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      dbDelete(id).catch(() => {});
      // If we deleted the active session, switch to the first remaining one
      if (id === currentIdRef.current) {
        if (next.length === 0) {
          const fresh = newSession();
          dbPut(fresh).catch(() => {});
          setCurrentId(fresh.id);
          setNameInput(fresh.name);
          return [fresh];
        }
        setCurrentId(next[0].id);
        setNameInput(next[0].name);
      }
      return next;
    });
  }, []);

  const commitName = useCallback(() => {
    const trimmed = nameInput.trim() || "Untitled";
    setNameInput(trimmed);
    setEditingName(false);
    const id = currentIdRef.current;
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, name: trimmed, updatedAt: Date.now() } : s,
      );
      const session = updated.find((s) => s.id === id);
      if (session) dbPut(session).catch(() => {});
      return updated;
    });
  }, [nameInput]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // Focus name input when editing starts
  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  // ---------------------------------------------------------------------------
  // Manual save
  // ---------------------------------------------------------------------------
  const handleSave = useCallback(() => {
    const id = currentIdRef.current;
    if (!id) return;
    // Flush any pending debounce first
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const session = sessionsRef.current.find((s) => s.id === id);
    if (session) dbPut(session).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas action helpers
  // The buttons use onMouseDown+preventDefault to keep focus on Excalidraw,
  // so by the time onClick fires the canvas is still active and Excalidraw's
  // keydown guard (contains(activeElement)) passes without any focus juggling.
  // ---------------------------------------------------------------------------
  const dispatchKey = useCallback((key: string, code: string, opts: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}) => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      code,
      ctrlKey: opts.ctrlKey ?? false,
      shiftKey: opts.shiftKey ?? false,
      metaKey: opts.metaKey ?? false,
      bubbles: true,
      cancelable: true,
    }));
  }, []);

  const handleZoomIn  = useCallback(() => dispatchKey("=", "Equal",  { ctrlKey: true }), [dispatchKey]);
  const handleZoomOut = useCallback(() => dispatchKey("-", "Minus",  { ctrlKey: true }), [dispatchKey]);
  const handleUndo    = useCallback(() => dispatchKey("z", "KeyZ",   { ctrlKey: true }), [dispatchKey]);
  const handleRedo    = useCallback(() => dispatchKey("z", "KeyZ",   { ctrlKey: true, shiftKey: true }), [dispatchKey]);

  // ---------------------------------------------------------------------------
  // Zoom input — commit a specific zoom % via updateScene
  // ---------------------------------------------------------------------------
  const commitZoom = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10);
    const clamped = Math.min(3000, Math.max(10, Number.isNaN(parsed) ? zoomLevel : parsed));
    setZoomLevel(clamped);
    setZoomInput(String(clamped));
    const api = excalidrawAPIRef.current;
    if (!api) return;
    // biome-ignore lint/suspicious/noExplicitAny: zoom value type not publicly exported
    api.updateScene({ appState: { zoom: { value: (clamped / 100) as any } } });
  }, [zoomLevel]);

  // ---------------------------------------------------------------------------
  // Global keybinds
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Capture-phase manager on document — intercepts Ctrl+S before Excalidraw
    // or the browser's native "Save page" handler can act on it.
    const captureKm = createKeybindManager(document, { capture: true });
    captureKm.register("ctrl+s", ({ event }) => {
      event.preventDefault();
      event.stopPropagation();
      handleSave();
    });
    // Also handle Cmd+S on macOS
    captureKm.register("meta+s", ({ event }) => {
      event.preventDefault();
      event.stopPropagation();
      handleSave();
    });

    return () => captureKm.dispose();
  }, [handleSave]);

  // ---------------------------------------------------------------------------
  // Web Share (PNG)
  // ---------------------------------------------------------------------------
  const canShare = typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;

  const handleShare = useCallback(async () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    if (elements.length === 0) return;
    const blob = await exportToBlob({
      elements, files, mimeType: "image/png",
      appState: { exportWithDarkMode: resolvedTheme === "dark" },
    });
    const sessionName = sessionsRef.current.find((s) => s.id === currentIdRef.current)?.name ?? "drawing";
    const file = new File([blob], `${sessionName}.png`, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    }
  }, [excalidrawAPI, resolvedTheme]);

  // ---------------------------------------------------------------------------
  // Clear current session canvas
  // ---------------------------------------------------------------------------
  const handleClear = useCallback(() => {
    if (!excalidrawAPI) return;
    excalidrawAPI.resetScene();
    const id = currentIdRef.current;
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, elements: [], appState: {}, files: {}, updatedAt: Date.now() } : s,
      );
      const session = updated.find((s) => s.id === id);
      if (session) dbPut(session).catch(() => {});
      return updated;
    });
  }, [excalidrawAPI]);

  // ---------------------------------------------------------------------------
  // Export helpers
  // ---------------------------------------------------------------------------

  const handleExportPng = useCallback(async () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    if (elements.length === 0) return;
    const blob = await exportToBlob({
      elements, files, mimeType: "image/png",
      appState: { exportWithDarkMode: false },
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessions.find((s) => s.id === currentId)?.name ?? "drawing"}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [excalidrawAPI, sessions, currentId]);

  const handleExportSvg = useCallback(async () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    if (elements.length === 0) return;
    const svg = await exportToSvg({
      elements, files,
      appState: { exportWithDarkMode: false },
    });
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessions.find((s) => s.id === currentId)?.name ?? "drawing"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [excalidrawAPI, sessions, currentId]);

  const handleExportJson = useCallback(() => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();
    const data = JSON.stringify({ elements, files }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessions.find((s) => s.id === currentId)?.name ?? "drawing"}.excalidraw`;
    a.click();
    URL.revokeObjectURL(url);
  }, [excalidrawAPI, sessions, currentId]);

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !excalidrawAPI) return;
      e.target.value = "";
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as {
            elements?: unknown[];
            files?: Record<string, unknown>;
          };
          excalidrawAPI.updateScene({
            // biome-ignore lint/suspicious/noExplicitAny: loaded from JSON, types not publicly exported
            elements: (data.elements ?? []) as any,
          });
          if (data.files) {
            // biome-ignore lint/suspicious/noExplicitAny: loaded from JSON, types not publicly exported
            excalidrawAPI.addFiles(Object.values(data.files) as any);
          }
        } catch {
          // ignore malformed file
        }
      };
      reader.readAsText(file);
    },
    [excalidrawAPI],
  );

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const currentSession = sessions.find((s) => s.id === currentId);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Top bar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex shrink-0 items-center gap-2 border-b py-3">
        {/* Back */}
        <Link
          href="/utils"
          aria-label="Back to utils"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <PenLine className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline font-bold">Excalidraw</span>

        <div className="hidden sm:block mx-2 h-4 w-px bg-border" />

        {/* Session name + picker */}
        <div className="relative flex items-center gap-1" ref={dropdownRef}>
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") { setEditingName(false); setNameInput(currentSession?.name ?? ""); }
                }}
                className="h-7 rounded border bg-background px-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ width: Math.max(80, nameInput.length * 8) }}
              />
              <button type="button" onClick={commitName} className="rounded p-0.5 hover:bg-accent" aria-label="Confirm name">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => { setEditingName(false); setNameInput(currentSession?.name ?? ""); }} className="rounded p-0.5 hover:bg-accent" aria-label="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-semibold hover:bg-accent transition-colors"
            >
              {currentSession?.name ?? "…"}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}

          {/* Sessions dropdown */}
          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover shadow-md">
              <div className="p-1">
                {sessions
                  .slice()
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((s) => (
                    <div
                      key={s.id}
                      className={[
                        "group flex items-center gap-1 rounded px-2 py-1.5 text-sm",
                        s.id === currentId ? "bg-accent" : "hover:bg-accent/60",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        className="flex-1 truncate text-left"
                        onClick={() => switchSession(s.id)}
                      >
                        {s.name}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-background transition-opacity"
                        aria-label="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          switchSession(s.id);
                          setEditingName(true);
                          setDropdownOpen(false);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-background text-destructive transition-opacity"
                        aria-label="Delete session"
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
              <div className="border-t p-1">
                <button
                  type="button"
                  onClick={createSession}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New session
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rename current session (pencil shortcut) — desktop only */}
        {!editingName && (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="hidden sm:flex rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Rename session"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-1">
          <input ref={fileInputRef} type="file" accept=".excalidraw,application/json" className="hidden" onChange={handleImport} />

          {/* Canvas controls — always visible.
              onMouseDown preventDefault keeps focus on the Excalidraw canvas
              so the canvas-action dispatch sees the correct activeElement. */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={handleUndo} aria-label="Undo">
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">Z</kbd></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={handleRedo} aria-label="Redo">
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">Shift</kbd>+<kbd className="font-mono">Z</kbd></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="mx-1 h-4 w-px bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={handleZoomOut} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">-</kbd></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} onClick={handleZoomIn} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">=</kbd></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <input
            type="text"
            inputMode="numeric"
            value={zoomInput}
            onChange={(e) => setZoomInput(e.target.value)}
            onBlur={() => commitZoom(zoomInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { commitZoom(zoomInput); e.currentTarget.blur(); }
              if (e.key === "Escape") { setZoomInput(String(zoomLevel)); e.currentTarget.blur(); }
            }}
            aria-label="Zoom level"
            className="w-12 rounded border bg-background px-1.5 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">%</span>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Options dropdown — same for mobile and desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={createSession}>
                <Plus className="h-4 w-4 mr-2" />
                New session
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
                <span className="ml-auto pl-4 text-xs text-muted-foreground">
                  <kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">S</kbd>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportPng}>
                <Download className="h-4 w-4 mr-2" />
                Export PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportSvg}>
                <Download className="h-4 w-4 mr-2" />
                Export SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJson}>
                <Download className="h-4 w-4 mr-2" />
                Export .excalidraw
              </DropdownMenuItem>
              {canShare && (
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share as PNG
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClear} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear canvas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteSession(currentIdRef.current)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Editor                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="min-h-0 flex-1" ref={excalidrawContainerRef}>
        <Excalidraw
          key={currentId}
          theme={resolvedTheme}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleChange}
          // biome-ignore lint/suspicious/noExplicitAny: excalidraw library item types not publicly exported
          onLibraryChange={(items: readonly any[]) => {
            setLibraryItems([...items]);
            dbPutLibrary([...items]).catch(() => {});
          }}
          initialData={{ libraryItems }}
          libraryReturnUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/utils/excalidraw`
              : "/utils/excalidraw"
          }
          UIOptions={{
            canvasActions: {
              export: false,
              saveToActiveFile: false,
              loadScene: false,
            },
          }}
        />
      </div>
    </div>
  );
}
