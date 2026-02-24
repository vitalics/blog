"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keybindManager } from "@/lib/keybind";
import {
  FileText,
  Upload,
  ArrowLeft,
  FilePlus,
  Plus,
  Clock,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  type Annotation,
  type TextAnnotation,
  type ImageAnnotation,
  type ShapeAnnotation,
  type DrawAnnotation,
  type SignatureAnnotation,
  type StoredSignature,
  type Status,
  type EditorMode,
  type SelectRect,
  isText,
  isShape,
  isDraw,
  isImage,
  isSignature,
  formatBytes,
  uid,
  contrastColor,
  SCALE_MIN,
  SCALE_MAX,
  SCALE_STEP,
  DEFAULT_FONT_SIZE,
  DEFAULT_COLOR,
  DEFAULT_BG_COLOR,
  isMac,
  parseHexToRgb01,
} from "./pdf-viewer.types";
import { PdfViewerTopBar } from "./pdf-viewer-topbar";
import { PdfViewerLeftSidebar } from "./pdf-viewer-left-sidebar";
import { PdfViewerEditor } from "./pdf-viewer-editor";
import { PdfViewerRightSidebar } from "./pdf-viewer-right-sidebar";

// ---------------------------------------------------------------------------
// IndexedDB — multi-session persistence
// ---------------------------------------------------------------------------

const IDB_DB = "pdf-viewer";
const IDB_STORE = "sessions";
const IDB_SIG_STORE = "signatures";
const IDB_HISTORY_STORE = "history";

interface StoredHistory {
  sessionId: string;
  undoStack: Annotation[][];
  redoStack: Annotation[][];
}

interface StoredSession {
  id: string;
  fileName: string;
  fileSize: number;
  savedAt: number; // Date.now()
  currentPage: number;
  totalPages: number;
  annotationCount: number;
  scale: number;
  annotations: Annotation[];
  fileBytes: ArrayBuffer;
}

// Cached connection — opened once and reused for all operations
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    // version 4: adds 'history' object store for undo/redo
    const req = indexedDB.open(IDB_DB, 4);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // drop legacy store if present
      if (db.objectStoreNames.contains("session"))
        db.deleteObjectStore("session");
      if (!db.objectStoreNames.contains(IDB_STORE))
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IDB_SIG_STORE))
        db.createObjectStore(IDB_SIG_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IDB_HISTORY_STORE))
        db.createObjectStore(IDB_HISTORY_STORE, { keyPath: "sessionId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function idbPut(session: StoredSession): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(): Promise<StoredSession[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// History IDB (undo/redo persistence)
// ---------------------------------------------------------------------------

async function saveHistory(
  sessionId: string,
  history: StoredHistory,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_HISTORY_STORE, "readwrite");
    tx.objectStore(IDB_HISTORY_STORE).put(history);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHistory(sessionId: string): Promise<StoredHistory | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_HISTORY_STORE, "readonly");
    const req = tx.objectStore(IDB_HISTORY_STORE).get(sessionId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteHistory(sessionId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_HISTORY_STORE, "readwrite");
    tx.objectStore(IDB_HISTORY_STORE).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Signatures IDB
// ---------------------------------------------------------------------------

async function sigPut(sig: StoredSignature): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SIG_STORE, "readwrite");
    tx.objectStore(IDB_SIG_STORE).put(sig);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function sigGetAll(): Promise<StoredSignature[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SIG_STORE, "readonly");
    const req = tx.objectStore(IDB_SIG_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function sigDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_SIG_STORE, "readwrite");
    tx.objectStore(IDB_SIG_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PdfViewerPage() {
  const router = useRouter();

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Editor state
  const [mode, setMode] = useState<EditorMode>("select");
  // Text input state for right panel
  const [panelText, setPanelText] = useState("");
  // Canvas dimensions state for proper annotation re-rendering on zoom
  const [canvasDimensions, setCanvasDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newFontSize, setNewFontSize] = useState(DEFAULT_FONT_SIZE);
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [newBgColor, setNewBgColor] = useState(DEFAULT_BG_COLOR);
  const [isExporting, setIsExporting] = useState(false);
  const [scanStatus, setScanStatus] = useState<
    "idle" | "scanning" | "found" | "notfound" | "ocr-found"
  >("idle");

  // Shape tool state
  const [shapeType, setShapeType] = useState<"circle" | "rect" | "line">(
    "rect",
  );
  const [arrowStart, setArrowStart] = useState(false);
  const [arrowEnd, setArrowEnd] = useState(true);
  const [newStrokeColor, setNewStrokeColor] = useState("#000000");
  const [newFillColor, setNewFillColor] = useState("none");
  const [newStrokeWidth, setNewStrokeWidth] = useState(2);
  const [shapeRect, setShapeRect] = useState<SelectRect | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Draw tool state
  const [livePoints, setLivePoints] = useState<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);

  // Signature tool state
  const [savedSignatures, setSavedSignatures] = useState<StoredSignature[]>([]);
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigDrawing, setSigDrawing] = useState(false); // true = draw-new tab, false = pick tab
  const [sigName, setSigName] = useState("My Signature");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigIsDrawingRef = useRef(false);
  const sigUndoStack = useRef<ImageData[]>([]);
  const sigRedoStack = useRef<ImageData[]>([]);

  // Clipboard for copy/cut/paste
  const clipboardRef = useRef<Annotation | null>(null);

  // Full-page OCR state
  const [pageOcrStatus, setPageOcrStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [pageOcrText, setPageOcrText] = useState<string>("");
  const [ocrCopied, setOcrCopied] = useState(false);
  const [ocrLang, setOcrLang] = useState("eng");

  // QR/Barcode generator panel state
  const [genText, setGenText] = useState("");
  const [genBarcodeFormat, setGenBarcodeFormat] = useState("CODE128");
  const [showGenPanel, setShowGenPanel] = useState(false);

  // New blank PDF
  const [newPdfName, setNewPdfName] = useState("document");

  // Area selection rubber-band
  const [selectRect, setSelectRect] = useState<SelectRect | null>(null);
  const selectStartRef = useRef<{ x: number; y: number } | null>(null);

  // Session persistence
  const [sessionSaved, setSessionSaved] = useState(false);
  const [savedSessions, setSavedSessions] = useState<StoredSession[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);

  // Undo / redo stacks (annotation snapshots only)
  const undoStack = useRef<Annotation[][]>([]);
  const redoStack = useRef<Annotation[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // biome-ignore lint/suspicious/noExplicitAny: pdfjs-dist types loaded dynamically
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origPoints?: { x: number; y: number }[];
    origX2?: number;
    origY2?: number;
  } | null>(null);
  const resizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const lineEndpointRef = useRef<{ id: string; end: "start" | "end" } | null>(
    null,
  );
  const annotationsRef = useRef<Annotation[]>([]);
  const preDragSnapshotRef = useRef<Annotation[] | null>(null);
  const dragAxisLockRef = useRef<"x" | "y" | null>(null);
  // Stores the last computed drag position so pointerUp can commit without setAnnotations during move
  const dragLiveRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragStartedRef = useRef(false);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  // Stable <style> element for imperatively hiding the dragged annotation — lives outside React
  const dragStyleRef = useRef<HTMLStyleElement | null>(null);
  if (!dragStyleRef.current) {
    const el = document.createElement("style");
    document.head.appendChild(el);
    dragStyleRef.current = el;
  }

  const preResizeSnapshotRef = useRef<Annotation[] | null>(null);
  const preEditSnapshotRef = useRef<Annotation[] | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Mutable refs for values used in saveCurrentSession — avoids recreating the
  // callback (and therefore the auto-save interval) on every state change.
  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);
  const scaleRef = useRef(scale);
  const pdfFileRef = useRef(pdfFile);

  // Pan offset for middle mouse button panning
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Keep all refs in sync with state
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    pdfFileRef.current = pdfFile;
  }, [pdfFile]);

  // Sync toolbar to selected annotation
  useEffect(() => {
    if (!selectedId) return;
    const ann = annotations.find((a) => a.id === selectedId);
    if (!ann) return;
    if (isShape(ann)) {
      setNewStrokeColor(ann.strokeColor);
      setNewFillColor(ann.fillColor);
      setNewStrokeWidth(ann.strokeWidth);
      if (ann.shape === "line") {
        setArrowStart(ann.arrowStart ?? false);
        setArrowEnd(ann.arrowEnd ?? true);
      }
    } else if (isDraw(ann)) {
      setNewStrokeColor(ann.strokeColor);
      setNewStrokeWidth(ann.strokeWidth);
    } else if (!isImage(ann) && ann && !isSignature(ann)) {
      setNewFontSize(ann.fontSize);
      setNewColor(ann.color);
      setNewBgColor(ann.bgColor);
      setPanelText(ann.text);
    }
  }, [selectedId, annotations]);

  // Show generator panel when mode changes to add-qr or add-barcode
  useEffect(() => {
    if (mode === "add-qr" || mode === "add-barcode") {
      setShowGenPanel(true);
    } else {
      setShowGenPanel(false);
    }
    // Clean up draw state when leaving draw mode
    if (mode !== "draw") {
      isDrawingRef.current = false;
      setLivePoints((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [mode]);

  // Load session list + signatures on mount
  useEffect(() => {
    idbGetAll()
      .then((all) =>
        setSavedSessions(all.sort((a, b) => b.savedAt - a.savedAt)),
      )
      .catch(() => {});
    sigGetAll()
      .then((all) =>
        setSavedSignatures(all.sort((a, b) => b.createdAt - a.createdAt)),
      )
      .catch(() => {});
  }, []);

  // Save current session to IndexedDB.
  // Uses refs for frequently-changing values so this callback (and therefore
  // the auto-save interval) is not recreated on every annotation change.
  const saveCurrentSession = useCallback(async () => {
    const file = pdfFileRef.current;
    if (status !== "ready" || !file || !pdfBytesRef.current) return;
    const annotations = annotationsRef.current;
    const id = currentSessionIdRef.current ?? uid();
    currentSessionIdRef.current = id;
    const session: StoredSession = {
      id,
      fileName: file.name,
      fileSize: file.size,
      savedAt: Date.now(),
      currentPage: currentPageRef.current,
      totalPages: totalPagesRef.current,
      annotationCount: annotations.length,
      scale: scaleRef.current,
      annotations,
      fileBytes: pdfBytesRef.current.slice(0),
    };
    await idbPut(session);
    setSavedSessions((prev) => {
      const without = prev.filter((s) => s.id !== id);
      return [session, ...without];
    });
    setSessionSaved(true);
    setTimeout(() => setSessionSaved(false), 2000);
  }, [status]);

  // Auto-save every 30 seconds while a PDF is open
  useEffect(() => {
    if (status !== "ready" || !pdfFileRef.current) return;
    const intervalId = setInterval(() => {
      saveCurrentSession().catch(() => {});
    }, 30000);
    return () => clearInterval(intervalId);
  }, [status, saveCurrentSession]);

  // ---------------------------------------------------------------------------
  // Undo / redo
  // ---------------------------------------------------------------------------

  const pushHistory = useCallback(
    (next: Annotation[], before?: Annotation[]) => {
      undoStack.current = [
        ...undoStack.current,
        before ?? annotationsRef.current,
      ];
      redoStack.current = [];
      setAnnotations(next);
      setCanUndo(true);
      setCanRedo(false);
      // Persist to IndexedDB
      const sessionId = currentSessionIdRef.current;
      if (sessionId) {
        saveHistory(sessionId, {
          sessionId,
          undoStack: undoStack.current,
          redoStack: redoStack.current,
        }).catch(() => {});
      }
    },
    [],
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, annotationsRef.current];
    setAnnotations(prev);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    // Persist to IndexedDB
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      saveHistory(sessionId, {
        sessionId,
        undoStack: undoStack.current,
        redoStack: redoStack.current,
      }).catch(() => {});
    }
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current[redoStack.current.length - 1];
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, annotationsRef.current];
    setAnnotations(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    // Persist to IndexedDB
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      saveHistory(sessionId, {
        sessionId,
        undoStack: undoStack.current,
        redoStack: redoStack.current,
      }).catch(() => {});
    }
  }, []);

  // Undo/redo keyboard shortcuts are handled in the consolidated keyboard handler below

  // Reset history when a new PDF is loaded
  const resetHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    // Clear history from IndexedDB
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      deleteHistory(sessionId).catch(() => {});
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load PDF
  // ---------------------------------------------------------------------------

  const loadPdf = useCallback(
    async (
      file: File,
      restoredAnnotations?: Annotation[],
      restoredPage?: number,
      restoredScale?: number,
      sessionId?: string,
    ) => {
      setStatus("loading");
      setErrorMsg(null);
      setCurrentPage(restoredPage ?? 1);
      setTotalPages(0);
      setAnnotations(restoredAnnotations ?? []);
      setSelectedId(null);
      setEditingId(null);
      setMode("select");
      if (restoredScale !== undefined) setScale(restoredScale);
      pdfDocRef.current = null;
      currentSessionIdRef.current = sessionId ?? null;
      resetHistory();

      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        pdfBytesRef.current = arrayBuffer;

        const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) })
          .promise;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setStatus("ready");

        setCanShare(
          !!navigator.share &&
            !!navigator.canShare &&
            navigator.canShare({
              files: [
                new File([arrayBuffer], file.name, { type: "application/pdf" }),
              ],
            }),
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load PDF.");
        setStatus("error");
      }
    },
    [resetHistory],
  );

  // ---------------------------------------------------------------------------
  // Render page to canvas
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || status !== "ready") return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // Update canvas dimensions state for annotations
        setCanvasDimensions({ width: viewport.width, height: viewport.height });
        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "RenderingCancelledException")
          setErrorMsg(err.message);
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [currentPage, scale, status]);

  useEffect(() => {
    const el = dragStyleRef.current;
    return () => { el?.remove(); };
  }, []);

  // ---------------------------------------------------------------------------
  // File input / drag-drop
  // ---------------------------------------------------------------------------

  // Convert image to PDF
  const convertImageToPdf = useCallback(
    async (file: File): Promise<File> => {
      const { PDFDocument } = await import("pdf-lib");

      // Read the image file
      const arrayBuffer = await file.arrayBuffer();
      // biome-ignore lint/suspicious/noExplicitAny: pdf-lib types loaded dynamically
      let image: any;
      let width: number;
      let height: number;

      // Create an image element to get dimensions
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const blob = new Blob([arrayBuffer]);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(blob);
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const imgElement = new window.Image();
      await new Promise<void>((resolve, reject) => {
        imgElement.onload = () => resolve();
        imgElement.onerror = () => reject(new Error("Failed to load image"));
        imgElement.src = dataUrl;
      });

      width = imgElement.naturalWidth;
      height = imgElement.naturalHeight;

      // Create PDF with image dimensions (scaled down if too large)
      const maxDimension = 2000;
      let scale = 1;
      if (width > maxDimension || height > maxDimension) {
        scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([width, height]);

      // Embed the image based on type
      const fileType = file.type.toLowerCase();
      if (fileType === "image/png" || fileType === "image/webp") {
        image = await pdfDoc.embedPng(arrayBuffer);
      } else if (fileType === "image/jpeg" || fileType === "image/jpg") {
        image = await pdfDoc.embedJpg(arrayBuffer);
      }

      if (image) {
        page.drawImage(image, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }

      const bytes = await pdfDoc.save();
      const name = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
      return new File([bytes.buffer as ArrayBuffer], name, {
        type: "application/pdf",
      });
    },
    [],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const fileType = file.type.toLowerCase();
      const isImage =
        fileType === "image/png" ||
        fileType === "image/jpeg" ||
        fileType === "image/jpg" ||
        fileType === "image/webp";

      if (isImage) {
        // Convert image to PDF first
        const pdfFile = await convertImageToPdf(file);
        setPdfFile(pdfFile);
        loadPdf(pdfFile);
      } else {
        setPdfFile(file);
        loadPdf(file);
      }
    },
    [loadPdf, convertImageToPdf],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ---------------------------------------------------------------------------
  // Viewer controls
  // ---------------------------------------------------------------------------

  const goToPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
    setSelectedId(null);
    setEditingId(null);
    setPageOcrStatus("idle");
    setPageOcrText("");
  }, []);
  const goToNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
    setSelectedId(null);
    setEditingId(null);
    setPageOcrStatus("idle");
    setPageOcrText("");
  }, [totalPages]);
  const zoomOut = useCallback(
    () => setScale((s) => Math.max(SCALE_MIN, +(s - SCALE_STEP).toFixed(2))),
    [],
  );
  const zoomIn = useCallback(
    () => setScale((s) => Math.min(SCALE_MAX, +(s + SCALE_STEP).toFixed(2))),
    [],
  );

  const handleClear = () => {
    setPdfFile(null);
    setStatus("idle");
    setErrorMsg(null);
    setCurrentPage(1);
    setTotalPages(0);
    setScale(1.0);
    setCanShare(false);
    setAnnotations([]);
    setSelectedId(null);
    setEditingId(null);
    setMode("select");
    pdfDocRef.current = null;
    pdfBytesRef.current = null;
    currentSessionIdRef.current = null;
  };

  const handleOpenSession = async (session: StoredSession) => {
    try {
      const file = new File([session.fileBytes], session.fileName, {
        type: "application/pdf",
      });
      setPdfFile(file);
      await loadPdf(
        file,
        session.annotations,
        session.currentPage,
        session.scale,
        session.id,
      );

      // Load history from IndexedDB
      const history = await loadHistory(session.id);
      if (history) {
        undoStack.current = history.undoStack;
        redoStack.current = history.redoStack;
        setCanUndo(history.undoStack.length > 0);
        setCanRedo(history.redoStack.length > 0);
      }
    } catch (err) {
      console.error("Failed to open session:", err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    await idbDelete(id).catch(() => {});
    await deleteHistory(id).catch(() => {});
    setSavedSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // ---------------------------------------------------------------------------
  // Signature handlers
  // ---------------------------------------------------------------------------

  const handleSigPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    sigIsDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSigPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sigIsDrawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d")!;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const handleSigPointerUp = () => {
    sigIsDrawingRef.current = false;
    // Save state after stroke is complete
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    sigUndoStack.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    );
    sigRedoStack.current = [];
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Save current state before clearing
    sigUndoStack.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    );
    sigRedoStack.current = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const sigUndo = useCallback(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (sigUndoStack.current.length === 0) return;
    // Save current state to redo stack
    sigRedoStack.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    );
    // Restore previous state
    const prevState = sigUndoStack.current.pop();
    if (prevState) {
      ctx.putImageData(prevState, 0, 0);
    }
  }, []);

  const sigRedo = useCallback(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (sigRedoStack.current.length === 0) return;
    // Save current state to undo stack
    sigUndoStack.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    );
    // Restore next state
    const nextState = sigRedoStack.current.pop();
    if (nextState) {
      ctx.putImageData(nextState, 0, 0);
    }
  }, []);

  const saveSignature = async () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const sig: StoredSignature = {
      id: uid(),
      name: sigName.trim() || "Signature",
      dataUrl,
      createdAt: Date.now(),
    };
    await sigPut(sig).catch(() => {});
    setSavedSignatures((prev) => [sig, ...prev]);
    setSigDrawing(false);
    clearSigCanvas();
  };

  const deleteSignature = async (id: string) => {
    await sigDelete(id).catch(() => {});
    setSavedSignatures((prev) => prev.filter((s) => s.id !== id));
  };

  const commitRename = async (id: string) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    const sig = savedSignatures.find((s) => s.id === id);
    if (!sig || sig.name === name) return;
    const updated = { ...sig, name };
    await sigPut(updated).catch(() => {});
    setSavedSignatures((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const placeSignature = (sig: StoredSignature) => {
    const annotation: SignatureAnnotation = {
      id: uid(),
      page: currentPage,
      xRatio: 0.1,
      yRatio: 0.1,
      wRatio: 0.3,
      hRatio: 0.15,
      dataUrl: sig.dataUrl,
      sigId: sig.id,
    };
    pushHistory([...annotationsRef.current, annotation]);
    setSelectedId(annotation.id);
    setShowSigModal(false);
    setMode("select");
  };

  // ---------------------------------------------------------------------------
  // Overlay interactions
  // ---------------------------------------------------------------------------

  const getCanvasRatio = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      xRatio: (clientX - rect.left) / rect.width,
      yRatio: (clientY - rect.top) / rect.height,
    };
  };

  const handleLineEndpointDown = (
    e: React.PointerEvent<SVGCircleElement>,
    id: string,
    end: "start" | "end",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    lineEndpointRef.current = { id, end };
    preDragSnapshotRef.current = annotationsRef.current;
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
  };

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle if clicking the overlay itself (not an annotation child)
    if (e.target !== overlayRef.current) return;

    if (mode === "area-scan" || mode === "area-ocr") {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      selectStartRef.current = { x, y };
      setSelectRect({ x1: x, y1: y, x2: x, y2: y });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (mode === "add-shape") {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      shapeStartRef.current = { x, y };
      setShapeRect({ x1: x, y1: y, x2: x, y2: y });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (mode === "draw") {
      e.preventDefault();
      const ratio = getCanvasRatio(e.clientX, e.clientY);
      if (!ratio) return;
      isDrawingRef.current = true;
      setLivePoints([{ x: ratio.xRatio, y: ratio.yRatio }]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (mode === "add-text") {
      const ratio = getCanvasRatio(e.clientX, e.clientY);
      if (!ratio) return;
      const annotation: TextAnnotation = {
        id: uid(),
        page: currentPage,
        ...ratio,
        text: "Text",
        fontSize: newFontSize,
        fontFamily: "helvetica",
        color: newColor,
        bgColor: newBgColor,
      };
      pushHistory([...annotationsRef.current, annotation]);
      setSelectedId(annotation.id);
      // Use setTimeout to ensure the input is rendered before setting editing mode
      // This allows the text selection to work properly
      setTimeout(() => {
        setEditingId(annotation.id);
        setMode("select");
      }, 0);
      return;
    }

    if (mode === "select") {
      setSelectedId(null);
    }
  };

  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lineEndpointRef.current) {
      const { id, end } = lineEndpointRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const xR = (e.clientX - rect.left) / rect.width;
      const yR = (e.clientY - rect.top) / rect.height;
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === id && isShape(a) && a.shape === "line"
            ? end === "start"
              ? { ...a, xRatio: xR, yRatio: yR }
              : { ...a, x2Ratio: xR, y2Ratio: yR }
            : a,
        ),
      );
      return;
    }
    if (
      (mode === "area-scan" || mode === "area-ocr") &&
      selectStartRef.current
    ) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectRect({
        x1: selectStartRef.current.x,
        y1: selectStartRef.current.y,
        x2: x,
        y2: y,
      });
      return;
    }
    if (mode === "add-shape" && shapeStartRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setShapeRect({
        x1: shapeStartRef.current.x,
        y1: shapeStartRef.current.y,
        x2: e.clientX - rect.left,
        y2: e.clientY - rect.top,
      });
      return;
    }
    if (mode === "draw" && isDrawingRef.current) {
      const ratio = getCanvasRatio(e.clientX, e.clientY);
      if (!ratio) return;
      setLivePoints((prev) => [...prev, { x: ratio.xRatio, y: ratio.yRatio }]);
    }
  };

  const handleOverlayPointerUp = async (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    // Commit line endpoint drag
    if (lineEndpointRef.current) {
      if (preDragSnapshotRef.current) {
        pushHistory(annotationsRef.current, preDragSnapshotRef.current);
      }
      lineEndpointRef.current = null;
      preDragSnapshotRef.current = null;
      return;
    }

    // Commit shape
    if (mode === "add-shape" && shapeStartRef.current && shapeRect) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (shapeType === "line") {
          const dist = Math.hypot(
            shapeRect.x2 - shapeRect.x1,
            shapeRect.y2 - shapeRect.y1,
          );
          if (dist > 5) {
            const annotation: ShapeAnnotation = {
              id: uid(),
              page: currentPage,
              xRatio: shapeRect.x1 / rect.width,
              yRatio: shapeRect.y1 / rect.height,
              x2Ratio: shapeRect.x2 / rect.width,
              y2Ratio: shapeRect.y2 / rect.height,
              wRatio: 0,
              hRatio: 0,
              shape: "line",
              strokeColor: newStrokeColor,
              fillColor: "none",
              strokeWidth: newStrokeWidth,
              arrowStart,
              arrowEnd,
            };
            pushHistory([...annotationsRef.current, annotation]);
            setSelectedId(annotation.id);
          }
        } else {
          const x1 = Math.min(shapeRect.x1, shapeRect.x2);
          const y1 = Math.min(shapeRect.y1, shapeRect.y2);
          const x2 = Math.max(shapeRect.x1, shapeRect.x2);
          const y2 = Math.max(shapeRect.y1, shapeRect.y2);
          if (x2 - x1 > 5 && y2 - y1 > 5) {
            const annotation: ShapeAnnotation = {
              id: uid(),
              page: currentPage,
              xRatio: x1 / rect.width,
              yRatio: y1 / rect.height,
              wRatio: (x2 - x1) / rect.width,
              hRatio: (y2 - y1) / rect.height,
              shape: shapeType,
              strokeColor: newStrokeColor,
              fillColor: newFillColor,
              strokeWidth: newStrokeWidth,
            };
            pushHistory([...annotationsRef.current, annotation]);
            setSelectedId(annotation.id);
          }
        }
      }
      shapeStartRef.current = null;
      setShapeRect(null);
      return;
    }

    // Commit freehand stroke
    if (mode === "draw" && isDrawingRef.current) {
      isDrawingRef.current = false;
      const pts = livePoints;
      if (pts.length >= 2) {
        const annotation: DrawAnnotation = {
          id: uid(),
          page: currentPage,
          points: pts,
          strokeColor: newStrokeColor,
          strokeWidth: newStrokeWidth,
        };
        pushHistory([...annotationsRef.current, annotation]);
        setSelectedId(annotation.id);
      }
      setLivePoints([]);
      return;
    }

    if (
      (mode !== "area-scan" && mode !== "area-ocr") ||
      !selectStartRef.current ||
      !selectRect
    )
      return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const x1 = Math.min(selectRect.x1, selectRect.x2);
    const y1 = Math.min(selectRect.y1, selectRect.y2);
    const x2 = Math.max(selectRect.x1, selectRect.x2);
    const y2 = Math.max(selectRect.y1, selectRect.y2);
    const w = x2 - x1;
    const h = y2 - y1;

    selectStartRef.current = null;
    setSelectRect(null);

    if (w < 10 || h < 10) return;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const offscreen = document.createElement("canvas");
    offscreen.width = w * scaleX;
    offscreen.height = h * scaleY;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      canvas,
      x1 * scaleX,
      y1 * scaleY,
      w * scaleX,
      h * scaleY,
      0,
      0,
      offscreen.width,
      offscreen.height,
    );

    const xRatio = (x1 + w / 2) / rect.width;
    const yRatio = (y1 + h / 2) / rect.height;

    const placeText = (text: string) => {
      const annotation: TextAnnotation = {
        id: uid(),
        page: currentPage,
        xRatio,
        yRatio,
        text,
        fontSize: newFontSize,
        fontFamily: "helvetica",
        color: newColor,
        bgColor: newBgColor,
      };
      pushHistory([...annotationsRef.current, annotation]);
      setSelectedId(annotation.id);
    };

    setScanStatus("scanning");

    if (mode === "area-ocr") {
      // OCR-only mode via Tesseract
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker();
        await worker.loadLanguage(ocrLang);
        await worker.initialize(ocrLang);
        const { data } = await worker.recognize(offscreen);
        await worker.terminate();
        const text = data.text.trim();
        if (text) {
          placeText(text);
          setScanStatus("ocr-found");
        } else {
          setScanStatus("notfound");
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "OCR failed.");
        setScanStatus("idle");
      }
      setTimeout(() => setScanStatus("idle"), 2500);
      return;
    }

    // QR / barcode mode — try BarcodeDetector first, then fall back to OCR
    try {
      let barcodeText: string | null = null;
      if ("BarcodeDetector" in window) {
        // biome-ignore lint/suspicious/noExplicitAny: BarcodeDetector not in TS lib
        const detector = new (window as any).BarcodeDetector({
          formats: [
            "qr_code",
            "code_128",
            "code_39",
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "itf",
            "codabar",
            "data_matrix",
            "pdf417",
            "aztec",
          ],
        });
        const bitmap = await createImageBitmap(offscreen);
        const detected = await detector.detect(bitmap);
        if (detected.length > 0) barcodeText = detected[0].rawValue;
      }

      if (barcodeText !== null) {
        placeText(barcodeText);
        setScanStatus("found");
        setTimeout(() => setScanStatus("idle"), 2500);
        return;
      }

      // No barcode found — fall back to OCR text extraction
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker();
      await worker.loadLanguage(ocrLang);
      await worker.initialize(ocrLang);
      const { data } = await worker.recognize(offscreen);
      await worker.terminate();
      const text = data.text.trim();
      if (text) {
        placeText(text);
        setScanStatus("ocr-found");
      } else {
        setScanStatus("notfound");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Scan failed.");
      setScanStatus("idle");
    }

    setTimeout(() => setScanStatus("idle"), 2500);
  };

  // ---------------------------------------------------------------------------
  // Annotation drag (text)
  // ---------------------------------------------------------------------------

  const handleAnnotationPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (editingId === id) return;
    setSelectedId(id);
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    const origX = isDraw(ann) ? (ann.points[0]?.x ?? 0) : ann.xRatio;
    const origY = isDraw(ann) ? (ann.points[0]?.y ?? 0) : ann.yRatio;
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
      origPoints: isDraw(ann) ? ann.points : undefined,
      origX2: isShape(ann) && ann.shape === "line" ? ann.x2Ratio : undefined,
      origY2: isShape(ann) && ann.shape === "line" ? ann.y2Ratio : undefined,
    };
    preDragSnapshotRef.current = annotationsRef.current;
    dragLiveRef.current = { dx: 0, dy: 0 };
    dragStartedRef.current = false;

    // Add window event listeners for reliable drag handling
    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      handleAnnotationPointerMove(moveEvent as unknown as React.PointerEvent);
    };
    const handleWindowPointerUp = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      handleAnnotationPointerUp();
    };
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
  };

  const handleAnnotationPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const shiftHeld = e.shiftKey;
    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let dx = (clientX - drag.startX) / rect.width;
      let dy = (clientY - drag.startY) / rect.height;

      // Shift = axis lock: determine axis from whichever direction moved more first
      if (shiftHeld) {
        if (!dragAxisLockRef.current) {
          const THRESHOLD = 2 / Math.max(rect.width, rect.height);
          if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
            dragAxisLockRef.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
          }
        }
        if (dragAxisLockRef.current === "x") dy = 0;
        else if (dragAxisLockRef.current === "y") dx = 0;
      } else {
        dragAxisLockRef.current = null;
      }

      dragLiveRef.current = { dx, dy };

      const pxDx = dx * rect.width;
      const pxDy = dy * rect.height;

      // Only start visual drag after crossing a 4px threshold
      if (!dragStartedRef.current && Math.abs(pxDx) + Math.abs(pxDy) > 4) {
        dragStartedRef.current = true;
        // Hide original via CSS (immune to React re-renders)
        if (dragStyleRef.current) {
          dragStyleRef.current.textContent = `[data-ann-id="${drag.id}"] { visibility: hidden !important; }`;
        }
        // Create a clone that we move imperatively as the ghost
        const original = overlayRef.current?.querySelector(`[data-ann-id="${drag.id}"]`) as HTMLElement | null;
        if (original && overlayRef.current) {
          const ghost = original.cloneNode(true) as HTMLElement;
          ghost.style.visibility = "visible";
          ghost.style.opacity = "0.6";
          ghost.style.pointerEvents = "none";
          ghost.removeAttribute("data-ann-id"); // so the CSS rule doesn't hide it
          overlayRef.current.appendChild(ghost);
          dragGhostRef.current = ghost;
        }
      }

      // Move the ghost
      if (dragGhostRef.current) {
        dragGhostRef.current.style.transform = `translate(${pxDx}px, ${pxDy}px)`;
      }
    });
  };

  const handleAnnotationPointerUp = () => {
    const drag = dragRef.current;
    if (drag && dragStartedRef.current) {
      const { dx, dy } = dragLiveRef.current;
      const snapshot = preDragSnapshotRef.current;

      const next = annotationsRef.current.map((a) => {
        if (a.id !== drag.id) return a;
        if (isDraw(a) && drag.origPoints) {
          return {
            ...a,
            points: drag.origPoints.map((p) => ({
              x: Math.max(0, Math.min(1, p.x + dx)),
              y: Math.max(0, Math.min(1, p.y + dy)),
            })),
          } as Annotation;
        }
        if (
          isShape(a) &&
          a.shape === "line" &&
          drag.origX2 !== undefined &&
          drag.origY2 !== undefined
        ) {
          return {
            ...a,
            xRatio: Math.max(0, Math.min(1, drag.origX + dx)),
            yRatio: Math.max(0, Math.min(1, drag.origY + dy)),
            x2Ratio: Math.max(0, Math.min(1, drag.origX2 + dx)),
            y2Ratio: Math.max(0, Math.min(1, drag.origY2 + dy)),
          } as Annotation;
        }
        return {
          ...a,
          xRatio: Math.max(0, Math.min(1, drag.origX + dx)),
          yRatio: Math.max(0, Math.min(1, drag.origY + dy)),
        } as Annotation;
      });

      pushHistory(next, snapshot ?? undefined);
      // Remove ghost and clear CSS hide rule after React paints the final position
      const ghost = dragGhostRef.current;
      requestAnimationFrame(() => {
        ghost?.remove();
        if (dragStyleRef.current) dragStyleRef.current.textContent = "";
      });
    }
    dragRef.current = null;
    dragGhostRef.current = null;
    preDragSnapshotRef.current = null;
    dragAxisLockRef.current = null;
    dragLiveRef.current = { dx: 0, dy: 0 };
    dragStartedRef.current = false;
  };

  // ---------------------------------------------------------------------------
  // Resize handle (image annotations)
  // ---------------------------------------------------------------------------

  const handleResizePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const ann = annotations.find((a) => a.id === id);
    if (!ann || (!isImage(ann) && !isShape(ann) && !isSignature(ann))) return;
    resizeRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origW: ann.wRatio,
      origH: ann.hRatio,
    };
    preResizeSnapshotRef.current = annotationsRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    const resize = resizeRef.current;
    if (!resize) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dw = (clientX - resize.startX) / rect.width;
      const dh = (clientY - resize.startY) / rect.height;
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === resize.id && (isImage(a) || isShape(a) || isSignature(a))
            ? {
                ...a,
                wRatio: Math.max(0.03, resize.origW + dw),
                hRatio: Math.max(0.03, resize.origH + dh),
              }
            : a,
        ),
      );
    });
  };

  const handleResizePointerUp = () => {
    if (resizeRef.current && preResizeSnapshotRef.current) {
      pushHistory(annotationsRef.current, preResizeSnapshotRef.current);
    }
    resizeRef.current = null;
    preResizeSnapshotRef.current = null;
  };

  // ---------------------------------------------------------------------------
  // Delete selected annotation
  // ---------------------------------------------------------------------------

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory(annotationsRef.current.filter((a) => a.id !== selectedId));
    setSelectedId(null);
    setEditingId(null);
  }, [selectedId, pushHistory]);

  // ---------------------------------------------------------------------------
  // Clipboard operations: copy, cut, paste
  // ---------------------------------------------------------------------------

  const copySelected = useCallback(() => {
    if (!selectedId) return;
    const ann = annotationsRef.current.find((a) => a.id === selectedId);
    if (!ann) return;
    clipboardRef.current = JSON.parse(JSON.stringify(ann)); // deep clone
  }, [selectedId]);

  const cutSelected = useCallback(() => {
    if (!selectedId) return;
    copySelected();
    deleteSelected();
  }, [selectedId, copySelected, deleteSelected]);

  const pasteAnnotation = useCallback(() => {
    if (!clipboardRef.current) return;
    const cloned = JSON.parse(
      JSON.stringify(clipboardRef.current),
    ) as Annotation;
    // Generate new ID and offset position slightly
    cloned.id = uid();
    cloned.page = currentPage;
    // Offset by a small amount (2% of canvas) for visual feedback
    if ("xRatio" in cloned) {
      cloned.xRatio = Math.min(1, (cloned.xRatio as number) + 0.02);
      cloned.yRatio = Math.min(1, (cloned.yRatio as number) + 0.02);
    }
    if ("points" in cloned) {
      cloned.points = cloned.points.map((p: { x: number; y: number }) => ({
        x: Math.min(1, p.x + 0.02),
        y: Math.min(1, p.y + 0.02),
      }));
    }
    pushHistory([...annotationsRef.current, cloned]);
    setSelectedId(cloned.id);
  }, [currentPage, pushHistory]);

  // ---------------------------------------------------------------------------
  // Save session shortcut
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    await saveCurrentSession();
  }, [saveCurrentSession]);

  // ---------------------------------------------------------------------------
  // Create text node shortcut
  // ---------------------------------------------------------------------------

  const createTextNode = useCallback(() => {
    // Create text node at center of current page
    const annotation: TextAnnotation = {
      id: uid(),
      page: currentPage,
      xRatio: 0.5,
      yRatio: 0.5,
      text: "Text",
      fontSize: newFontSize,
      fontFamily: "helvetica",
      color: newColor,
      bgColor: newBgColor,
    };
    pushHistory([...annotationsRef.current, annotation]);
    setSelectedId(annotation.id);
    // Delay setting editing mode to prevent keypress from being typed
    setTimeout(() => setEditingId(annotation.id), 10);
  }, [currentPage, newFontSize, newColor, newBgColor, pushHistory]);

  // ---------------------------------------------------------------------------
  // Add image from file upload
  // ---------------------------------------------------------------------------

  const addImageFromFile = useCallback(
    async (file: File) => {
      try {
        const arrayBuffer = await file.arrayBuffer();

        // Get image dimensions
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const blob = new Blob([arrayBuffer]);
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(blob);
        });

        const imgElement = new window.Image();
        await new Promise<void>((resolve, reject) => {
          imgElement.onload = () => resolve();
          imgElement.onerror = () => reject(new Error("Failed to load image"));
          imgElement.src = dataUrl;
        });

        // Calculate aspect ratio for the annotation
        const canvas = canvasRef.current;
        const canvasAspect = (canvas?.width ?? 600) / (canvas?.height ?? 800);
        const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight;

        // Default width ratio
        const wRatio = 0.4;
        const hRatio = wRatio * (imgAspect / canvasAspect);

        const annotation: ImageAnnotation = {
          id: uid(),
          page: currentPage,
          xRatio: 0.1,
          yRatio: 0.1,
          wRatio,
          hRatio,
          dataUrl,
          label: file.name,
        };
        pushHistory([...annotationsRef.current, annotation]);
        setSelectedId(annotation.id);
        setMode("select");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to add image.");
      }
    },
    [currentPage, pushHistory],
  );

  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/jpg,image/webp";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await addImageFromFile(file);
      }
    };
    input.click();
  }, [addImageFromFile]);

  // Replace existing image with new one
  const replaceImage = useCallback(
    async (file: File, annotationId: string) => {
      try {
        const arrayBuffer = await file.arrayBuffer();

        // Get image dimensions
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const blob = new Blob([arrayBuffer]);
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(blob);
        });

        const imgElement = new window.Image();
        await new Promise<void>((resolve, reject) => {
          imgElement.onload = () => resolve();
          imgElement.onerror = () => reject(new Error("Failed to load image"));
          imgElement.src = dataUrl;
        });

        // Get the existing annotation to preserve position
        const existingAnn = annotationsRef.current.find(
          (a) => a.id === annotationId,
        );
        if (!existingAnn || !isImage(existingAnn)) return;

        const existingImg = existingAnn as ImageAnnotation;

        // Calculate new aspect ratio
        const canvas = canvasRef.current;
        const canvasAspect = (canvas?.width ?? 600) / (canvas?.height ?? 800);
        const imgAspect = imgElement.naturalWidth / imgElement.naturalHeight;

        // Keep the same width, calculate new height
        const wRatio = existingImg.wRatio;
        const hRatio = wRatio * (imgAspect / canvasAspect);

        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === annotationId
              ? ({
                  ...a,
                  dataUrl,
                  label: file.name,
                  wRatio,
                  hRatio,
                } as ImageAnnotation)
              : a,
          ),
        );
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to replace image.",
        );
      }
    },
    [],
  );

  const handleImageReplace = useCallback(
    (annotationId: string) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/jpg,image/webp";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          await replaceImage(file, annotationId);
        }
      };
      input.click();
    },
    [replaceImage],
  );

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts using keybindManager
  // ---------------------------------------------------------------------------

  // Refs to access latest values in keybind callbacks
  const selectedIdRef = useRef(selectedId);
  const editingIdRef = useRef(editingId);
  const modeRef = useRef(mode);
  const shapeTypeRef = useRef(shapeType);
  const annotationsRefLocal = useRef(annotations);
  const setAnnotationsRef = useRef(setAnnotations);
  const setModeRef = useRef(setMode);
  const setShowSigModalRef = useRef(setShowSigModal);
  const setShapeTypeRef = useRef(setShapeType);

  // Update refs when values change
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);
  useEffect(() => {
    pdfFileRef.current = pdfFile;
  }, [pdfFile]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);
  useEffect(() => {
    shapeTypeRef.current = shapeType;
  }, [shapeType]);
  useEffect(() => {
    annotationsRefLocal.current = annotations;
  }, [annotations]);

  useEffect(() => {
    const handles: ReturnType<typeof keybindManager.register>[] = [];

    // Ctrl/Cmd + Z - Undo
    handles.push(
      keybindManager.register("ctrl+z", (ctx) => {
        ctx.event.preventDefault();
        undo();
      }),
    );

    // Ctrl/Cmd + Shift + Z - Redo
    handles.push(
      keybindManager.register("ctrl+shift+z", (ctx) => {
        ctx.event.preventDefault();
        redo();
      }),
    );

    // Ctrl/Cmd + Y - Redo
    handles.push(
      keybindManager.register("ctrl+y", (ctx) => {
        ctx.event.preventDefault();
        redo();
      }),
    );

    // Ctrl/Cmd + C - Copy
    handles.push(
      keybindManager.register("ctrl+c", (ctx) => {
        if (selectedIdRef.current) {
          ctx.event.preventDefault();
          copySelected();
        }
      }),
    );

    // Ctrl/Cmd + X - Cut
    handles.push(
      keybindManager.register("ctrl+x", (ctx) => {
        if (selectedIdRef.current) {
          ctx.event.preventDefault();
          cutSelected();
        }
      }),
    );

    // Ctrl/Cmd + V - Paste
    handles.push(
      keybindManager.register("ctrl+v", (ctx) => {
        if (clipboardRef.current) {
          ctx.event.preventDefault();
          pasteAnnotation();
        }
      }),
    );

    // Ctrl/Cmd + S - Save
    handles.push(
      keybindManager.register("ctrl+s", (ctx) => {
        ctx.event.preventDefault();
        handleSave();
      }),
    );

    // Delete/Backspace - delete selected annotation
    handles.push(
      keybindManager.register("delete", (ctx) => {
        if (selectedIdRef.current && editingIdRef.current !== selectedIdRef.current) {
          deleteSelected();
        }
      }),
    );
    handles.push(
      keybindManager.register("backspace", (ctx) => {
        if (selectedIdRef.current && editingIdRef.current !== selectedIdRef.current) {
          deleteSelected();
        }
      }),
    );

    // T key - Toggle text mode
    handles.push(
      keybindManager.register("t", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          ctx.event.stopPropagation();
          setModeRef.current(modeRef.current === "add-text" ? "select" : "add-text");
        }
      }),
    );

    // F key - Toggle freehand draw mode
    handles.push(
      keybindManager.register("f", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setModeRef.current(modeRef.current === "draw" ? "select" : "draw");
        }
      }),
    );

    // S key - Toggle signature mode (but not when Ctrl/Cmd is pressed - that's save)
    handles.push(
      keybindManager.register("s", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setModeRef.current("add-signature");
          setShowSigModalRef.current(true);
        }
      }),
    );

    // B key - Toggle barcode mode
    handles.push(
      keybindManager.register("b", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setModeRef.current(modeRef.current === "add-barcode" ? "select" : "add-barcode");
        }
      }),
    );

    // Q key - Toggle QR code mode
    handles.push(
      keybindManager.register("q", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setModeRef.current(modeRef.current === "add-qr" ? "select" : "add-qr");
        }
      }),
    );

    // O key - Toggle OCR text mode
    handles.push(
      keybindManager.register("o", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setModeRef.current(modeRef.current === "area-ocr" ? "select" : "area-ocr");
        }
      }),
    );

    // I key - Add image from file
    handles.push(
      keybindManager.register("i", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          handleImageUpload();
        }
      }),
    );

    // + or = key - Increase size of selected element OR zoom in
    handles.push(
      keybindManager.register("+", (ctx) => {
        if (!ctx.control && !ctx.meta && pdfFileRef.current) {
          ctx.event.preventDefault();
          if (selectedIdRef.current && !editingIdRef.current) {
            const ann = annotationsRefLocal.current.find((a) => a.id === selectedIdRef.current);
            if (ann && isText(ann)) {
              const a = ann as TextAnnotation;
              const newSize = Math.min(200, (a.fontSize || 16) + 2);
              setAnnotationsRef.current((prev) =>
                prev.map((item) =>
                  item.id === selectedIdRef.current
                    ? { ...item, fontSize: newSize }
                    : item,
                ),
              );
            } else if (ann && (isImage(ann) || isShape(ann) || isSignature(ann))) {
              const a = ann as ImageAnnotation | ShapeAnnotation | SignatureAnnotation;
              const resizeAmount = 0.05;
              setAnnotationsRef.current((prev) =>
                prev.map((item) =>
                  item.id === selectedIdRef.current
                    ? { ...item, wRatio: (a.wRatio || 0) + resizeAmount, hRatio: (a.hRatio || 0) + resizeAmount }
                    : item,
                ),
              );
            }
          } else {
            zoomIn();
          }
        }
      }),
    );

    // = key (same as +)
    handles.push(
      keybindManager.register("=", (ctx) => {
        if (!ctx.control && !ctx.meta && pdfFileRef.current) {
          ctx.event.preventDefault();
          if (selectedIdRef.current && !editingIdRef.current) {
            const ann = annotationsRefLocal.current.find((a) => a.id === selectedIdRef.current);
            if (ann && isText(ann)) {
              const a = ann as TextAnnotation;
              const newSize = Math.min(200, (a.fontSize || 16) + 2);
              setAnnotationsRef.current((prev) =>
                prev.map((item) =>
                  item.id === selectedIdRef.current
                    ? { ...item, fontSize: newSize }
                    : item,
                ),
              );
            } else if (ann && (isImage(ann) || isShape(ann) || isSignature(ann))) {
              const a = ann as ImageAnnotation | ShapeAnnotation | SignatureAnnotation;
              const resizeAmount = 0.05;
              setAnnotationsRef.current((prev) =>
                prev.map((item) =>
                  item.id === selectedIdRef.current
                    ? { ...item, wRatio: (a.wRatio || 0) + resizeAmount, hRatio: (a.hRatio || 0) + resizeAmount }
                    : item,
                ),
              );
            }
          } else {
            zoomIn();
          }
        }
      }),
    );

    // - key - Decrease size of selected element OR zoom out
    handles.push(
      keybindManager.register("-", (ctx) => {
        if (!ctx.control && !ctx.meta && pdfFileRef.current) {
          ctx.event.preventDefault();
          if (selectedIdRef.current && !editingIdRef.current) {
            const ann = annotationsRefLocal.current.find((a) => a.id === selectedIdRef.current);
            if (ann && isText(ann)) {
              const a = ann as TextAnnotation;
              const newSize = Math.max(6, (a.fontSize || 16) - 2);
              setAnnotationsRef.current((prev) =>
                prev.map((item) =>
                  item.id === selectedIdRef.current
                    ? { ...item, fontSize: newSize }
                    : item,
                ),
              );
            } else if (ann && (isImage(ann) || isShape(ann) || isSignature(ann))) {
              const a = ann as ImageAnnotation | ShapeAnnotation | SignatureAnnotation;
              const resizeAmount = 0.05;
              setAnnotationsRef.current((prev) =>
                prev.map((item) =>
                  item.id === selectedIdRef.current
                    ? { ...item, wRatio: Math.max(0.03, (a.wRatio || 0) - resizeAmount), hRatio: Math.max(0.03, (a.hRatio || 0) - resizeAmount) }
                    : item,
                ),
              );
            }
          } else {
            zoomOut();
          }
        }
      }),
    );

    // ArrowRight - Move selected annotation right OR go to next page
    handles.push(
      keybindManager.register("right", (ctx) => {
        if (!ctx.control && !ctx.meta && pdfFileRef.current) {
          ctx.event.preventDefault();
          if (selectedIdRef.current && !editingIdRef.current) {
            const ann = annotationsRefLocal.current.find((a) => a.id === selectedIdRef.current);
            if (ann && "xRatio" in ann) {
              const newX = Math.min(0.95, (ann.xRatio || 0) + 0.01);
              setAnnotationsRef.current((prev) =>
                prev.map((a) =>
                  a.id === selectedIdRef.current ? { ...a, xRatio: newX } : a,
                ),
              );
            }
          } else if (currentPageRef.current < totalPagesRef.current) {
            goToNext();
          }
        }
      }),
    );

    // ArrowLeft - Move selected annotation left OR go to previous page
    handles.push(
      keybindManager.register("left", (ctx) => {
        if (!ctx.control && !ctx.meta && pdfFileRef.current) {
          ctx.event.preventDefault();
          if (selectedIdRef.current && !editingIdRef.current) {
            const ann = annotationsRefLocal.current.find((a) => a.id === selectedIdRef.current);
            if (ann && "xRatio" in ann) {
              const newX = Math.max(0.05, (ann.xRatio || 0) - 0.01);
              setAnnotationsRef.current((prev) =>
                prev.map((a) =>
                  a.id === selectedIdRef.current ? { ...a, xRatio: newX } : a,
                ),
              );
            }
          } else if (currentPageRef.current > 1) {
            goToPrev();
          }
        }
      }),
    );

    // ArrowUp - Move selected annotation up
    handles.push(
      keybindManager.register("up", (ctx) => {
        if (!ctx.control && !ctx.meta && pdfFileRef.current) {
          ctx.event.preventDefault();
          if (selectedIdRef.current && !editingIdRef.current) {
            const ann = annotationsRefLocal.current.find((a) => a.id === selectedIdRef.current);
            if (ann && "yRatio" in ann) {
              const newY = Math.max(0.05, (ann.yRatio || 0) - 0.01);
              setAnnotationsRef.current((prev) =>
                prev.map((a) =>
                  a.id === selectedIdRef.current ? { ...a, yRatio: newY } : a,
                ),
              );
            }
          }
        }
      }),
    );

    // ArrowDown - Move selected annotation down
    handles.push(
      keybindManager.register("down", (ctx) => {
        if (!ctx.control && !ctx.meta && pdfFileRef.current) {
          ctx.event.preventDefault();
          if (selectedIdRef.current && !editingIdRef.current) {
            const ann = annotationsRefLocal.current.find((a) => a.id === selectedIdRef.current);
            if (ann && "yRatio" in ann) {
              const newY = Math.min(0.95, (ann.yRatio || 0) + 0.01);
              setAnnotationsRef.current((prev) =>
                prev.map((a) =>
                  a.id === selectedIdRef.current ? { ...a, yRatio: newY } : a,
                ),
              );
            }
          }
        }
      }),
    );

    // R key - Rectangle mode
    handles.push(
      keybindManager.register("r", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setShapeTypeRef.current("rect");
          setModeRef.current(
            modeRef.current === "add-shape" && shapeTypeRef.current === "rect" ? "select" : "add-shape",
          );
        }
      }),
    );

    // C key - Circle mode
    handles.push(
      keybindManager.register("c", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setShapeTypeRef.current("circle");
          setModeRef.current(
            modeRef.current === "add-shape" && shapeTypeRef.current === "circle"
              ? "select"
              : "add-shape",
          );
        }
      }),
    );

    // L key - Line mode
    handles.push(
      keybindManager.register("l", (ctx) => {
        if (!ctx.control && !ctx.meta && !editingIdRef.current && pdfFileRef.current) {
          ctx.event.preventDefault();
          setShapeTypeRef.current("line");
          setModeRef.current(
            modeRef.current === "add-shape" && shapeTypeRef.current === "line" ? "select" : "add-shape",
          );
        }
      }),
    );

    // Cleanup: unregister all keybind handles
    return () => {
      handles.forEach((handle) => handle.unregister());
    };
  }, [
    undo,
    redo,
    copySelected,
    cutSelected,
    pasteAnnotation,
    handleSave,
    deleteSelected,
    zoomIn,
    zoomOut,
    goToNext,
    goToPrev,
    handleImageUpload,
  ]);

  // ---------------------------------------------------------------------------
  // Generate QR and place as image annotation
  // ---------------------------------------------------------------------------

  const placeQrCode = async () => {
    if (!genText.trim()) return;
    try {
      const QRCode = await import("qrcode");
      const offscreen = document.createElement("canvas");
      await QRCode.toCanvas(offscreen, genText.trim(), {
        width: 200,
        errorCorrectionLevel: "M",
      });
      const dataUrl = offscreen.toDataURL("image/png");

      const annotation: ImageAnnotation = {
        id: uid(),
        page: currentPage,
        xRatio: 0.1,
        yRatio: 0.1,
        wRatio: 0.25,
        hRatio: 0.25,
        dataUrl,
        label: `QR: ${genText.slice(0, 30)}`,
      };
      pushHistory([...annotationsRef.current, annotation]);
      setSelectedId(annotation.id);
      setMode("select");
      setGenText("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "QR generation failed.");
    }
  };

  // ---------------------------------------------------------------------------
  // Generate barcode and place as image annotation
  // ---------------------------------------------------------------------------

  const placeBarcodeImage = async () => {
    if (!genText.trim()) return;
    try {
      const JsBarcode = (await import("jsbarcode")).default;
      const offscreen = document.createElement("canvas");
      JsBarcode(offscreen, genText.trim(), {
        format: genBarcodeFormat,
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
      });
      const dataUrl = offscreen.toDataURL("image/png");
      const canvas = canvasRef.current;
      const aspectRatio = offscreen.height / offscreen.width;
      const wRatio = 0.4;
      const hRatio =
        wRatio *
        aspectRatio *
        ((canvas?.width ?? 600) / (canvas?.height ?? 800));

      const annotation: ImageAnnotation = {
        id: uid(),
        page: currentPage,
        xRatio: 0.1,
        yRatio: 0.1,
        wRatio,
        hRatio,
        dataUrl,
        label: `${genBarcodeFormat}: ${genText.slice(0, 20)}`,
      };
      pushHistory([...annotationsRef.current, annotation]);
      setSelectedId(annotation.id);
      setMode("select");
      setGenText("");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Barcode generation failed. Is jsbarcode installed?",
      );
    }
  };



  // ---------------------------------------------------------------------------
  // Export / Share
  // ---------------------------------------------------------------------------

  const buildAnnotatedPdfBytes = async (): Promise<Uint8Array> => {
    const { PDFDocument, rgb, StandardFonts, LineCapStyle } =
      await import("pdf-lib");

    // biome-ignore lint/suspicious/noExplicitAny: pdf-lib types loaded dynamically
    function drawPdfArrow(
      page: any,
      from: { x: number; y: number },
      to: { x: number; y: number },
      color: any,
      size: number,
    ) {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const left = {
        x: to.x - size * Math.cos(angle - Math.PI / 6),
        y: to.y - size * Math.sin(angle - Math.PI / 6),
      };
      const right = {
        x: to.x - size * Math.cos(angle + Math.PI / 6),
        y: to.y - size * Math.sin(angle + Math.PI / 6),
      };
      const thickness = Math.max(size * 0.4, 1);
      page.drawLine({
        start: to,
        end: left,
        color,
        thickness,
        lineCap: LineCapStyle.Round,
      });
      page.drawLine({
        start: to,
        end: right,
        color,
        thickness,
        lineCap: LineCapStyle.Round,
      });
    }

    const pdfDoc = await PDFDocument.load(pdfBytesRef.current!);

    // Font embedding helper
    // biome-ignore lint/suspicious/noExplicitAny: pdf-lib types
    const getFont = async (fontFamily: string) => {
      const fontMap: Record<string, any> = {
        "helvetica": StandardFonts.Helvetica,
        "helvetica-bold": StandardFonts.HelveticaBold,
        "helvetica-oblique": StandardFonts.HelveticaOblique,
        "helvetica-bold-oblique": StandardFonts.HelveticaBoldOblique,
        "times-roman": StandardFonts.TimesRoman,
        "times-bold": StandardFonts.TimesRomanBold,
        "times-italic": StandardFonts.TimesRomanItalic,
        "times-bold-italic": StandardFonts.TimesRomanBoldItalic,
        "courier": StandardFonts.Courier,
        "courier-bold": StandardFonts.CourierBold,
        "courier-oblique": StandardFonts.CourierOblique,
        "courier-bold-oblique": StandardFonts.CourierBoldOblique,
        "symbol": StandardFonts.Symbol,
        "zapfdingbats": StandardFonts.ZapfDingbats,
      };
      const sf = fontMap[fontFamily] ?? StandardFonts.Helvetica;
      return pdfDoc.embedFont(sf);
    };

    const pages = pdfDoc.getPages();

    for (const ann of annotationsRef.current) {
      const pdfPage = pages[ann.page - 1];
      if (!pdfPage) continue;
      const { width: pw, height: ph } = pdfPage.getSize();

      if (isSignature(ann)) {
        const res = await fetch(ann.dataUrl);
        const bytes = await res.arrayBuffer();
        const img = await pdfDoc.embedPng(bytes);
        const x = ann.xRatio * pw;
        const y = ph - ann.yRatio * ph - ann.hRatio * ph;
        pdfPage.drawImage(img, {
          x,
          y,
          width: ann.wRatio * pw,
          height: ann.hRatio * ph,
        });
      } else if (isImage(ann)) {
        const res = await fetch(ann.dataUrl);
        const bytes = await res.arrayBuffer();
        const img = await pdfDoc.embedPng(bytes);
        const x = ann.xRatio * pw;
        const y = ph - ann.yRatio * ph - ann.hRatio * ph;
        pdfPage.drawImage(img, {
          x,
          y,
          width: ann.wRatio * pw,
          height: ann.hRatio * ph,
        });
      } else if (isShape(ann)) {
        const { r: sr, g: sg, b: sb } = parseHexToRgb01(ann.strokeColor);
        const strokeCol = rgb(sr, sg, sb);
        if (ann.shape === "line") {
          const x1 = ann.xRatio * pw;
          const y1 = ph - ann.yRatio * ph;
          const x2 = (ann.x2Ratio ?? ann.xRatio) * pw;
          const y2 = ph - (ann.y2Ratio ?? ann.yRatio) * ph;
          pdfPage.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            color: strokeCol,
            thickness: ann.strokeWidth,
            lineCap: LineCapStyle.Round,
          });
          const arrowSize = Math.max(ann.strokeWidth * 4, 8);
          if (ann.arrowEnd)
            drawPdfArrow(
              pdfPage,
              { x: x1, y: y1 },
              { x: x2, y: y2 },
              strokeCol,
              arrowSize,
            );
          if (ann.arrowStart)
            drawPdfArrow(
              pdfPage,
              { x: x2, y: y2 },
              { x: x1, y: y1 },
              strokeCol,
              arrowSize,
            );
        } else {
          const x = ann.xRatio * pw;
          const w = ann.wRatio * pw;
          const h = ann.hRatio * ph;
          // PDF y-axis is bottom-up; yRatio is top-down
          const y = ph - ann.yRatio * ph - h;
          const fillColor =
            ann.fillColor !== "none"
              ? (() => {
                  const { r, g, b } = parseHexToRgb01(ann.fillColor);
                  return rgb(r, g, b);
                })()
              : undefined;
          if (ann.shape === "circle") {
            pdfPage.drawEllipse({
              x: x + w / 2,
              y: y + h / 2,
              xScale: w / 2,
              yScale: h / 2,
              borderColor: strokeCol,
              borderWidth: ann.strokeWidth,
              color: fillColor,
              opacity: fillColor ? 1 : 0,
              borderOpacity: 1,
            });
          } else {
            pdfPage.drawRectangle({
              x,
              y,
              width: w,
              height: h,
              borderColor: strokeCol,
              borderWidth: ann.strokeWidth,
              color: fillColor,
              opacity: fillColor ? 1 : 0,
              borderOpacity: 1,
            });
          }
        }
      } else if (isDraw(ann)) {
        if (ann.points.length < 2) continue;
        const { r, g, b } = parseHexToRgb01(ann.strokeColor);
        // Build an SVG path string from points (PDF coords, y flipped)
        const pathParts = ann.points.map((p, i) => {
          const px = p.x * pw;
          const py = ph - p.y * ph;
          return i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`;
        });
        pdfPage.drawSvgPath(pathParts.join(" "), {
          color: undefined,
          borderColor: rgb(r, g, b),
          borderWidth: ann.strokeWidth,
          borderLineCap: LineCapStyle.Round,
        });
      } else if (isText(ann)) {
        const textFont = await getFont(ann.fontFamily ?? "helvetica");
        const x = ann.xRatio * pw;
        const y = ph - ann.yRatio * ph - ann.fontSize;
        const { r, g, b } = parseHexToRgb01(ann.color);
        if (ann.bgColor !== "none") {
          const tw = textFont.widthOfTextAtSize(ann.text, ann.fontSize);
          const { r: br, g: bg, b: bb } = parseHexToRgb01(ann.bgColor);
          pdfPage.drawRectangle({
            x,
            y,
            width: tw,
            height: ann.fontSize,
            color: rgb(br, bg, bb),
          });
        }
        pdfPage.drawText(ann.text, {
          x,
          y,
          size: ann.fontSize,
          font: textFont,
          color: rgb(r, g, b),
        });
      }
    }

    return pdfDoc.save();
  };

  // ---------------------------------------------------------------------------
  // Full-page OCR
  // ---------------------------------------------------------------------------

  const handlePageOcr = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPageOcrStatus("running");
    setPageOcrText("");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker();
      await worker.loadLanguage(ocrLang);
      await worker.initialize(ocrLang);
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      const text = data.text.trim();
      setPageOcrText(text);
      setPageOcrStatus(text ? "done" : "error");
    } catch {
      setPageOcrStatus("error");
    }
  };

  const handleOcrCopy = () => {
    navigator.clipboard
      .writeText(pageOcrText)
      .then(() => {
        setOcrCopied(true);
        setTimeout(() => setOcrCopied(false), 2000);
      })
      .catch(() => {});
  };

  const handleExport = async () => {
    if (!pdfBytesRef.current || !pdfFile) return;
    setIsExporting(true);
    try {
      const bytes = await buildAnnotatedPdfBytes();
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFile.name.replace(/\.pdf$/i, "") + "-edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const [isSharing, setIsSharing] = useState(false);
  // Pre-built annotated File kept ready so navigator.share() can be called
  // synchronously within the user gesture (Safari requires no await before share).
  const shareFileRef = useRef<File | null>(null);
  const [shareReady, setShareReady] = useState(false);

  // Rebuild the share file in the background whenever content changes.
  // Debounced 800 ms to avoid rebuilding on every keystroke.
  // totalPages is included as a proxy for page add/delete (updates pdfBytesRef).
  useEffect(() => {
    if (status !== "ready" || !pdfFile || !pdfBytesRef.current) {
      shareFileRef.current = null;
      setShareReady((prev) => (prev ? false : prev));
      return;
    }
    const name = pdfFile.name;
    let cancelled = false;
    setShareReady((prev) => (prev ? false : prev));
    const timer = setTimeout(() => {
      buildAnnotatedPdfBytes()
        .then((bytes) => {
          if (!cancelled) {
            shareFileRef.current = new File(
              [bytes.buffer as ArrayBuffer],
              name,
              { type: "application/pdf" },
            );
            setShareReady(true);
          }
        })
        .catch(() => {});
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, pdfFile, totalPages]);

  const handleShare = () => {
    if (!shareFileRef.current) return;
    // No await before navigator.share() — transient activation is preserved for Safari.
    // Only pass `files` — mixing `title` causes macOS Safari to drop the attachment.
    setIsSharing(true);
    navigator
      .share({ files: [shareFileRef.current] })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          setErrorMsg("Share failed.");
        }
      })
      .finally(() => setIsSharing(false));
  };

  // ---------------------------------------------------------------------------
  // Create blank PDF
  // ---------------------------------------------------------------------------

  const createNewPdf = async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]); // A4
    const bytes = await pdfDoc.save();
    const name =
      (newPdfName.trim() || "document").replace(/\.pdf$/i, "") + ".pdf";
    const file = new File([bytes.buffer as ArrayBuffer], name, {
      type: "application/pdf",
    });
    handleFile(file);
  };

  // ---------------------------------------------------------------------------
  // Add blank page
  // ---------------------------------------------------------------------------

  const addPage = async () => {
    if (!pdfBytesRef.current || !pdfDocRef.current || !pdfFile) return;
    const { PDFDocument } = await import("pdf-lib");
    // Get current page size to match
    const currentPdfPage = await pdfDocRef.current.getPage(currentPage);
    const viewport = currentPdfPage.getViewport({ scale: 1 });
    const pdfDoc = await PDFDocument.load(pdfBytesRef.current);
    pdfDoc.insertPage(currentPage, [viewport.width, viewport.height]);
    const bytes = await pdfDoc.save();
    pdfBytesRef.current = bytes.buffer as ArrayBuffer;
    const newFile = new File([bytes.buffer as ArrayBuffer], pdfFile.name, {
      type: "application/pdf",
    });
    setPdfFile(newFile);
    // Reload pdfjs doc
    const pdfjsLib = await import("pdfjs-dist");
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    pdfDocRef.current = doc;
    setTotalPages(doc.numPages);
    setCurrentPage(currentPage + 1);
  };

  // ---------------------------------------------------------------------------
  // Delete current page
  // ---------------------------------------------------------------------------

  const deletePage = async () => {
    if (!pdfBytesRef.current || !pdfDocRef.current || !pdfFile) return;
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(pdfBytesRef.current);

    // Remove annotations on the deleted page; shift page numbers for later pages
    pushHistory(
      annotationsRef.current
        .filter((a) => a.page !== currentPage)
        .map((a) => (a.page > currentPage ? { ...a, page: a.page - 1 } : a)),
    );

    if (pdfDoc.getPageCount() <= 1) {
      // Last page — replace with a single blank A4 page
      pdfDoc.removePage(0);
      pdfDoc.addPage([595, 842]);
      const bytes = await pdfDoc.save();
      pdfBytesRef.current = bytes.buffer as ArrayBuffer;
      const newFile = new File([bytes.buffer as ArrayBuffer], pdfFile.name, {
        type: "application/pdf",
      });
      setPdfFile(newFile);
      const pdfjsLib = await import("pdfjs-dist");
      const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      pdfDocRef.current = doc;
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }

    pdfDoc.removePage(currentPage - 1);
    const bytes = await pdfDoc.save();
    pdfBytesRef.current = bytes.buffer as ArrayBuffer;
    const newFile = new File([bytes.buffer as ArrayBuffer], pdfFile.name, {
      type: "application/pdf",
    });
    setPdfFile(newFile);
    const pdfjsLib = await import("pdfjs-dist");
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    pdfDocRef.current = doc;
    const newTotal = doc.numPages;
    setTotalPages(newTotal);
    setCurrentPage((p) => Math.min(p, newTotal));
    setSelectedId(null);
    setEditingId(null);
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const pageAnnotations = annotations.filter((a) => a.page === currentPage);

  const updateSelected = (patch: Partial<TextAnnotation>) => {
    if (!selectedId) return;
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === selectedId && isText(a) ? { ...a, ...patch } : a,
      ),
    );
  };

  const commitSelectedUpdate = (patch: Partial<TextAnnotation>) => {
    if (!selectedId) return;
    const next = annotationsRef.current.map((a) =>
      a.id === selectedId && isText(a) ? { ...a, ...patch } : a,
    );
    pushHistory(next);
  };

  const updateSelectedShape = (
    patch: Partial<ShapeAnnotation & DrawAnnotation>,
  ) => {
    if (!selectedId) return;
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === selectedId && (isShape(a) || isDraw(a))
          ? ({ ...a, ...patch } as Annotation)
          : a,
      ),
    );
  };

  const commitSelectedShapeUpdate = (
    patch: Partial<ShapeAnnotation & DrawAnnotation>,
  ) => {
    if (!selectedId) return;
    const next = annotationsRef.current.map((a) =>
      a.id === selectedId && (isShape(a) || isDraw(a))
        ? ({ ...a, ...patch } as Annotation)
        : a,
    );
    pushHistory(next);
  };

  const commitAnnotationPatch = (patch: Partial<Annotation>) => {
    if (!selectedId) return;
    const next = annotationsRef.current.map((a) =>
      a.id === selectedId ? ({ ...a, ...patch } as Annotation) : a,
    );
    pushHistory(next);
  };

  const selectedAnn = annotations.find((a) => a.id === selectedId);
  const selectedIsText = selectedAnn ? isText(selectedAnn) : false;
  const selectedIsShape = selectedAnn ? isShape(selectedAnn) : false;
  const selectedIsDraw = selectedAnn ? isDraw(selectedAnn) : false;

  // Overlay cursor
  const overlayCursor =
    mode === "add-text"
      ? "cursor-crosshair"
      : mode === "area-scan"
        ? "cursor-crosshair"
        : mode === "area-ocr"
          ? "cursor-crosshair"
          : mode === "add-shape"
            ? "cursor-crosshair"
            : mode === "draw"
              ? "cursor-crosshair"
              : "cursor-default";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <FileText
              className="h-7 w-7 text-muted-foreground"
              aria-hidden="true"
            />
            <h1 className="text-4xl font-bold">PDF Viewer</h1>
          </div>
          <p className="text-muted-foreground">
            View and annotate PDF files in your browser. Nothing is uploaded.
          </p>
        </div>

        {/* Recent files list */}
        {savedSessions.length > 0 && status === "idle" && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Recent files</h2>
            </div>
            <ul className="space-y-2">
              {savedSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <FileText
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(s.fileSize)} · {s.totalPages}{" "}
                      {s.totalPages === 1 ? "page" : "pages"} ·{" "}
                      {s.annotationCount} annotation
                      {s.annotationCount !== 1 ? "s" : ""} ·{" "}
                      {new Date(s.savedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => handleOpenSession(s)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Open
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete session"
                    onClick={() => handleDeleteSession(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Open existing PDF */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop a PDF here or click to select"
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={[
                "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
              ].join(" ")}
            >
              <Upload
                className="h-10 w-10 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Drop a PDF or image here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse (PDF, PNG, JPG, WEBP)
                </p>
              </div>
              {status === "error" && errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
            </div>

            {/* Create new blank PDF */}
            <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/25 p-8 text-center">
              <FilePlus
                className="h-10 w-10 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Create a blank PDF</p>
                <p className="text-sm text-muted-foreground">
                  Start from scratch (A4)
                </p>
              </div>
              <div className="flex w-full max-w-xs items-center gap-2">
                <input
                  type="text"
                  placeholder="document"
                  value={newPdfName}
                  onChange={(e) => setNewPdfName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createNewPdf();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  .pdf
                </span>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  createNewPdf();
                }}
              >
                <Plus className="h-4 w-4" /> Create
              </Button>
            </div>
          </div>
        )}

        {status === "loading" && (
          <div className="flex min-h-56 items-center justify-center rounded-xl border">
            <p className="animate-pulse text-muted-foreground">Loading PDF…</p>
          </div>
        )}

        {/* Viewer + Editor */}
        {status === "ready" && pdfFile && (
          <div className="flex flex-col gap-3">
            <PdfViewerTopBar
              pdfFile={pdfFile}
              onClose={handleClear}
              currentPage={currentPage}
              totalPages={totalPages}
              onGoToPrev={goToPrev}
              onGoToNext={goToNext}
              onAddPage={addPage}
              onDeletePage={deletePage}
              scale={scale}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              sessionSaved={sessionSaved}
              isExporting={isExporting}
              canShare={canShare}
              isSharing={isSharing}
              shareReady={shareReady}
              onSave={handleSave}
              onExport={handleExport}
              onShare={handleShare}
              mode={mode}
              shapeType={shapeType}
              selectedIsShape={selectedIsShape}
              selectedIsDraw={selectedIsDraw}
              selectedAnn={selectedAnn}
              annotations={annotations}
              selectedId={selectedId}
              panelText={panelText}
              newStrokeColor={newStrokeColor}
              newFillColor={newFillColor}
              newStrokeWidth={newStrokeWidth}
              newFontSize={newFontSize}
              newColor={newColor}
              newBgColor={newBgColor}
              arrowStart={arrowStart}
              arrowEnd={arrowEnd}
              ocrLang={ocrLang}
              onSetOcrLang={setOcrLang}
              onSetPanelText={setPanelText}
              onSetNewStrokeColor={setNewStrokeColor}
              onSetNewFillColor={setNewFillColor}
              onSetNewStrokeWidth={setNewStrokeWidth}
              onSetNewFontSize={setNewFontSize}
              onSetNewColor={setNewColor}
              onSetNewBgColor={setNewBgColor}
              onSetArrowStart={setArrowStart}
              onSetArrowEnd={setArrowEnd}
              onUpdateSelected={updateSelected}
              onCommitSelectedUpdate={commitSelectedUpdate}
              onUpdateSelectedShape={updateSelectedShape}
              onCommitSelectedShapeUpdate={commitSelectedShapeUpdate}
              onSetSelectedId={setSelectedId}
              onSetCurrentPage={setCurrentPage}
              onDeleteSelected={deleteSelected}
            />
            {/* Three-column layout */}
            <div className="flex gap-3">
              <PdfViewerLeftSidebar
                mode={mode}
                onSetMode={setMode}
                shapeType={shapeType}
                onSetShapeType={setShapeType}
                pageOcrStatus={pageOcrStatus}
                onHandlePageOcr={handlePageOcr}
                onHandleImageUpload={handleImageUpload}
                showSigModal={showSigModal}
                onSetShowSigModal={setShowSigModal}
                sigDrawing={sigDrawing}
                onSetSigDrawing={setSigDrawing}
                sigName={sigName}
                onSetSigName={setSigName}
                savedSignatures={savedSignatures}
                renamingId={renamingId}
                onSetRenamingId={setRenamingId}
                renameValue={renameValue}
                onSetRenameValue={setRenameValue}
                sigCanvasRef={sigCanvasRef}
                onSigPointerDown={handleSigPointerDown}
                onSigPointerMove={handleSigPointerMove}
                onSigPointerUp={handleSigPointerUp}
                onClearSigCanvas={clearSigCanvas}
                onSigUndo={sigUndo}
                onSigRedo={sigRedo}
                onSaveSignature={saveSignature}
                onPlaceSignature={placeSignature}
                onDeleteSignature={deleteSignature}
                onCommitRename={commitRename}
              />

              <PdfViewerEditor
                canvasRef={canvasRef}
                overlayRef={overlayRef}
                currentPage={currentPage}
                canvasDimensions={canvasDimensions}
                mode={mode}
                shapeType={shapeType}
                scanStatus={scanStatus}
                pageOcrStatus={pageOcrStatus}
                pageOcrText={pageOcrText}
                ocrCopied={ocrCopied}
                onSetPageOcrStatus={setPageOcrStatus}
                onSetPageOcrText={setPageOcrText}
                onHandleOcrCopy={handleOcrCopy}
                showGenPanel={showGenPanel}
                genText={genText}
                genBarcodeFormat={genBarcodeFormat}
                onSetGenText={setGenText}
                onSetGenBarcodeFormat={setGenBarcodeFormat}
                onPlaceQrCode={placeQrCode}
                onPlaceBarcodeImage={placeBarcodeImage}
                annotations={pageAnnotations}
                selectedId={selectedId}
                editingId={editingId}

                onSetAnnotations={setAnnotations}
                onSetSelectedId={setSelectedId}
                onSetEditingId={setEditingId}
                shapeRect={shapeRect}
                selectRect={selectRect}
                newStrokeColor={newStrokeColor}
                newStrokeWidth={newStrokeWidth}
                newFillColor={newFillColor}
                arrowStart={arrowStart}
                arrowEnd={arrowEnd}
                livePoints={livePoints}
                overlayCursor={overlayCursor}
                onOverlayPointerDown={handleOverlayPointerDown}
                onOverlayPointerMove={handleOverlayPointerMove}
                onOverlayPointerUp={handleOverlayPointerUp}
                onAnnotationPointerDown={handleAnnotationPointerDown}
                onAnnotationPointerMove={handleAnnotationPointerMove}
                onAnnotationPointerUp={handleAnnotationPointerUp}
                onResizePointerDown={handleResizePointerDown}
                onResizePointerMove={handleResizePointerMove}
                onResizePointerUp={handleResizePointerUp}
                onLineEndpointDown={handleLineEndpointDown}
                panelText={panelText}
                onSetPanelText={setPanelText}
                scale={scale}
                lastTapTimeRef={lastTapTimeRef}
                annotationsRef={annotationsRef}
                preEditSnapshotRef={preEditSnapshotRef}
                onPushHistory={pushHistory}
              />

              <PdfViewerRightSidebar
                mode={mode}
                shapeType={shapeType}
                selectedId={selectedId}
                selectedAnn={selectedAnn}
                selectedIsShape={selectedIsShape}
                selectedIsDraw={selectedIsDraw}
                panelText={panelText}
                newFontSize={newFontSize}
                newColor={newColor}
                newBgColor={newBgColor}
                newStrokeColor={newStrokeColor}
                newFillColor={newFillColor}
                newStrokeWidth={newStrokeWidth}
                arrowStart={arrowStart}
                arrowEnd={arrowEnd}
                ocrLang={ocrLang}
                annotations={annotations}
                currentPage={currentPage}
                onSetOcrLang={setOcrLang}
                onSetPanelText={setPanelText}
                onSetNewFontSize={setNewFontSize}
                onSetNewColor={setNewColor}
                onSetNewBgColor={setNewBgColor}
                onSetNewStrokeColor={setNewStrokeColor}
                onSetNewFillColor={setNewFillColor}
                onSetNewStrokeWidth={setNewStrokeWidth}
                onSetArrowStart={setArrowStart}
                onSetArrowEnd={setArrowEnd}
                onUpdateSelected={updateSelected}
                onCommitSelectedUpdate={commitSelectedUpdate}
                onUpdateSelectedShape={updateSelectedShape}
                onCommitSelectedShapeUpdate={commitSelectedShapeUpdate}
                onSetSelectedId={setSelectedId}
                onSetCurrentPage={setCurrentPage}
                onDeleteSelected={deleteSelected}
                onHandleImageReplace={handleImageReplace}
                onSetAnnotations={setAnnotations}
                onCommitAnnotationPatch={commitAnnotationPatch}
              />
            </div>

            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </TooltipProvider>
  );
}
