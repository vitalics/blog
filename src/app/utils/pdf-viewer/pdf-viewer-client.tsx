"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Download,
  Share2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  Type,
  Trash2,
  MousePointer,
  ScanLine,
  QrCode,
  Barcode,
  FilePlus,
  Plus,
  Minus,
  Save,
  Undo2,
  Redo2,
  Clock,
  FolderOpen,
  CaseSensitive,
  FileSearch,
  Copy,
  Check,
  Shapes,
  Square,
  Circle,
  Pencil,
  PencilLine,
  PenLine,
  RotateCcw,
  ChevronsUpDown,
  Menu,
  SlidersHorizontal,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

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

interface StoredSignature {
  id: string;
  name: string;
  dataUrl: string; // PNG data URL of the drawn signature
  createdAt: number;
}

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
// ---------------------------------------------------------------------------
// OCR languages
// ---------------------------------------------------------------------------

const OCR_LANGUAGES = [
  { value: "eng", label: "English" },
  { value: "rus", label: "Russian" },
  { value: "ukr", label: "Ukrainian" },
  { value: "deu", label: "German" },
  { value: "fra", label: "French" },
  { value: "spa", label: "Spanish" },
  { value: "ita", label: "Italian" },
  { value: "por", label: "Portuguese" },
  { value: "pol", label: "Polish" },
  { value: "tur", label: "Turkish" },
  { value: "ara", label: "Arabic" },
  { value: "hin", label: "Hindi" },
  { value: "chi_sim", label: "Chinese (Simplified)" },
  { value: "chi_tra", label: "Chinese (Traditional)" },
  { value: "jpn", label: "Japanese" },
  { value: "kor", label: "Korean" },
] as const;

// ---------------------------------------------------------------------------
// Standard fonts
// ---------------------------------------------------------------------------

const STANDARD_FONTS = [
  { value: "helvetica", label: "Helvetica" },
  { value: "helvetica-bold", label: "Helvetica Bold" },
  { value: "helvetica-oblique", label: "Helvetica Italic" },
  { value: "helvetica-bold-oblique", label: "Helvetica Bold Italic" },
  { value: "times-roman", label: "Times New Roman" },
  { value: "times-bold", label: "Times New Roman Bold" },
  { value: "times-italic", label: "Times New Roman Italic" },
  { value: "times-bold-italic", label: "Times New Roman Bold Italic" },
  { value: "courier", label: "Courier" },
  { value: "courier-bold", label: "Courier Bold" },
  { value: "courier-oblique", label: "Courier Italic" },
  { value: "courier-bold-oblique", label: "Courier Bold Italic" },
  { value: "symbol", label: "Symbol" },
  { value: "zapfdingbats", label: "Zapf Dingbats" },
] as const;

// Searchable combobox for font selection
function FontSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = STANDARD_FONTS.find((f) => f.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={[
            "flex h-8 w-full items-center justify-between gap-1 rounded border bg-background px-2 text-sm font-normal",
            "hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring",
          ].join(" ")}
        >
          <span className="truncate">{selected?.label ?? "Font"}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search font…" className="h-8 text-sm" />
          <CommandList>
            <CommandEmpty>No font found.</CommandEmpty>
            <CommandGroup>
              {STANDARD_FONTS.map((f) => (
                <CommandItem
                  key={f.value}
                  value={f.label}
                  onSelect={() => {
                    onChange(f.value);
                    setOpen(false);
                  }}
                  className="text-sm"
                >
                  <Check
                    className={[
                      "mr-2 h-3.5 w-3.5",
                      value === f.value ? "opacity-100" : "opacity-0",
                    ].join(" ")}
                  />
                  {f.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Helper to detect macOS for keyboard shortcut display
const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Searchable combobox for OCR language selection
function OcrLangSelect({
  value,
  onChange,
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const selected = OCR_LANGUAGES.find((l) => l.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={[
            "flex items-center justify-between gap-1 rounded border bg-background font-normal",
            "hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring",
            size === "sm" ? "h-7 px-2 text-xs" : "h-8 w-full px-2 text-sm",
          ].join(" ")}
        >
          <span className="truncate">{selected?.label ?? "Language"}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search language…"
            className="h-8 text-sm"
          />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {OCR_LANGUAGES.map((l) => (
                <CommandItem
                  key={l.value}
                  value={l.label}
                  onSelect={() => {
                    onChange(l.value);
                    setOpen(false);
                  }}
                  className="text-sm"
                >
                  <Check
                    className={[
                      "mr-2 h-3.5 w-3.5",
                      value === l.value ? "opacity-100" : "opacity-0",
                    ].join(" ")}
                  />
                  {l.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Status = "idle" | "loading" | "ready" | "error";
type EditorMode =
  | "select"
  | "add-text"
  | "area-scan"
  | "area-ocr"
  | "add-qr"
  | "add-barcode"
  | "add-shape"
  | "draw"
  | "add-signature"
  | "add-image";

interface TextAnnotation {
  id: string;
  page: number;
  /** Position as 0–1 fraction of canvas size, scale-independent */
  xRatio: number;
  yRatio: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bgColor: string;
}

interface ImageAnnotation {
  id: string;
  page: number;
  xRatio: number;
  yRatio: number;
  /** Width as fraction of canvas width */
  wRatio: number;
  /** Height as fraction of canvas height */
  hRatio: number;
  /** PNG data URL */
  dataUrl: string;
  label: string;
}

interface ShapeAnnotation {
  id: string;
  page: number;
  xRatio: number;
  yRatio: number;
  wRatio: number;
  hRatio: number;
  shape: "circle" | "rect" | "line";
  strokeColor: string;
  fillColor: string; // hex or 'none'
  strokeWidth: number;
  x2Ratio?: number; // end-point x (normalized, line only)
  y2Ratio?: number; // end-point y (normalized, line only)
  arrowStart?: boolean; // arrowhead at start
  arrowEnd?: boolean; // arrowhead at end
}

interface DrawAnnotation {
  id: string;
  page: number;
  points: { x: number; y: number }[];
  strokeColor: string;
  strokeWidth: number;
}

interface SignatureAnnotation {
  id: string;
  page: number;
  xRatio: number;
  yRatio: number;
  wRatio: number;
  hRatio: number;
  /** PNG data URL of the signature */
  dataUrl: string;
  /** ID of the StoredSignature it came from */
  sigId: string;
}

type Annotation =
  | TextAnnotation
  | ImageAnnotation
  | ShapeAnnotation
  | DrawAnnotation
  | SignatureAnnotation;

/** Selection rect while rubber-banding */
interface SelectRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSignature(a: Annotation): a is SignatureAnnotation {
  return "sigId" in a;
}
function isImage(a: Annotation): a is ImageAnnotation {
  return "dataUrl" in a && !isSignature(a);
}
function isShape(a: Annotation): a is ShapeAnnotation {
  return "shape" in a;
}
function isDraw(a: Annotation): a is DrawAnnotation {
  return "points" in a;
}
function isText(a: Annotation): a is TextAnnotation {
  return (
    "text" in a && !isShape(a) && !isDraw(a) && !isImage(a) && !isSignature(a)
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseHexToRgb01(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** Returns '#ffffff' or '#000000' — whichever contrasts better against the given hex color. */
function contrastColor(hex: string): string {
  const { r, g, b } = parseHexToRgb01(hex);
  // Relative luminance (WCAG formula)
  const lum = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

const SCALE_MIN = 0.5;
const SCALE_MAX = 3.0;
const SCALE_STEP = 0.25;
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_COLOR = "#000000";
const DEFAULT_BG_COLOR = "none";

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
  const preResizeSnapshotRef = useRef<Annotation[] | null>(null);
  const preEditSnapshotRef = useRef<Annotation[] | null>(null);

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
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleAnnotationPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (clientX - drag.startX) / rect.width;
      const dy = (clientY - drag.startY) / rect.height;
      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id !== drag.id) return a;
          if (isDraw(a) && drag.origPoints) {
            return {
              ...a,
              points: drag.origPoints.map((p) => ({
                x: Math.max(0, Math.min(1, p.x + dx)),
                y: Math.max(0, Math.min(1, p.y + dy)),
              })),
            };
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
            };
          }
          return {
            ...a,
            xRatio: Math.max(0, Math.min(1, drag.origX + dx)),
            yRatio: Math.max(0, Math.min(1, drag.origY + dy)),
          };
        }),
      );
    });
  };

  const handleAnnotationPointerUp = () => {
    if (dragRef.current && preDragSnapshotRef.current) {
      pushHistory(annotationsRef.current, preDragSnapshotRef.current);
    }
    dragRef.current = null;
    preDragSnapshotRef.current = null;
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

  // Consolidated keyboard shortcuts handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;

      // Signature modal undo/redo (takes precedence when modal is open)
      if (showSigModal && sigDrawing) {
        if (mod && e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          sigUndo();
          return;
        }
        if (mod && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
          e.preventDefault();
          sigRedo();
          return;
        }
      }

      // Don't trigger shortcuts when typing in input/textarea
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + Z - Undo
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if (mod && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl/Cmd + C - Copy
      if (mod && e.key === "c" && selectedId) {
        e.preventDefault();
        copySelected();
        return;
      }

      // Ctrl/Cmd + X - Cut
      if (mod && e.key === "x" && selectedId) {
        e.preventDefault();
        cutSelected();
        return;
      }

      // Ctrl/Cmd + V - Paste
      if (mod && e.key === "v" && clipboardRef.current) {
        e.preventDefault();
        pasteAnnotation();
        return;
      }

      // Ctrl/Cmd + S - Save
      if (mod && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Delete/Backspace - delete selected annotation
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        editingId !== selectedId
      ) {
        deleteSelected();
        return;
      }

      // T key - Toggle text mode (only when not in text editing mode)
      if (e.key === "t" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        e.stopPropagation();
        setMode(mode === "add-text" ? "select" : "add-text");
        return;
      }

      // F key - Toggle freehand draw mode
      if (e.key === "f" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setMode(mode === "draw" ? "select" : "draw");
        return;
      }

      // S key - Toggle signature mode (but not when Ctrl/Cmd is pressed - that's save)
      if (e.key === "s" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setMode("add-signature");
        setShowSigModal(true);
        return;
      }

      // B key - Toggle barcode mode
      if (e.key === "b" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setMode(mode === "add-barcode" ? "select" : "add-barcode");
        return;
      }

      // Q key - Toggle QR code mode
      if (e.key === "q" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setMode(mode === "add-qr" ? "select" : "add-qr");
        return;
      }

      // O key - Toggle OCR text mode
      if (e.key === "o" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setMode(mode === "area-ocr" ? "select" : "area-ocr");
        return;
      }

      // I key - Add image from file
      if (e.key === "i" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        handleImageUpload();
        return;
      }

      // + or = key - Increase size of selected element OR zoom in
      if ((e.key === "+" || e.key === "=") && !mod && pdfFile) {
        e.preventDefault();
        if (selectedId && !editingId) {
          // Increase size of selected element (images, shapes, signatures, text)
          const ann = annotationsRef.current.find((a) => a.id === selectedId);
          if (ann && isText(ann)) {
            // Increase font size for text
            const a = ann as TextAnnotation;
            const newSize = Math.min(200, (a.fontSize || 16) + 2);
            setAnnotations((prev) =>
              prev.map((item) =>
                item.id === selectedId
                  ? { ...item, fontSize: newSize }
                  : item,
              ),
            );
          } else if (ann && (isImage(ann) || isShape(ann) || isSignature(ann))) {
            const a = ann as ImageAnnotation | ShapeAnnotation | SignatureAnnotation;
            const resizeAmount = 0.05;
            setAnnotations((prev) =>
              prev.map((item) =>
                item.id === selectedId
                  ? { ...item, wRatio: (a.wRatio || 0) + resizeAmount, hRatio: (a.hRatio || 0) + resizeAmount }
                  : item,
              ),
            );
          }
        } else {
          zoomIn();
        }
        return;
      }

      // - key - Decrease size of selected element OR zoom out
      if (e.key === "-" && !mod && pdfFile) {
        e.preventDefault();
        if (selectedId && !editingId) {
          // Decrease size of selected element (images, shapes, signatures, text)
          const ann = annotationsRef.current.find((a) => a.id === selectedId);
          if (ann && isText(ann)) {
            // Decrease font size for text
            const a = ann as TextAnnotation;
            const newSize = Math.max(6, (a.fontSize || 16) - 2);
            setAnnotations((prev) =>
              prev.map((item) =>
                item.id === selectedId
                  ? { ...item, fontSize: newSize }
                  : item,
              ),
            );
          } else if (ann && (isImage(ann) || isShape(ann) || isSignature(ann))) {
            const a = ann as ImageAnnotation | ShapeAnnotation | SignatureAnnotation;
            const resizeAmount = 0.05;
            setAnnotations((prev) =>
              prev.map((item) =>
                item.id === selectedId
                  ? { ...item, wRatio: Math.max(0.03, (a.wRatio || 0) - resizeAmount), hRatio: Math.max(0.03, (a.hRatio || 0) - resizeAmount) }
                  : item,
              ),
            );
          }
        } else {
          zoomOut();
        }
        return;
      }

      // ArrowRight - Move selected annotation right OR go to next page
      if (e.key === "ArrowRight" && !mod && pdfFile) {
        e.preventDefault();
        if (selectedId && !editingId) {
          // Move selected annotation right by small amount
          const ann = annotationsRef.current.find((a) => a.id === selectedId);
          if (ann && "xRatio" in ann) {
            const newX = Math.min(0.95, (ann.xRatio || 0) + 0.01);
            setAnnotations((prev) =>
              prev.map((a) =>
                a.id === selectedId ? { ...a, xRatio: newX } : a,
              ),
            );
          }
        } else if (currentPage < totalPages) {
          goToNext();
        }
        return;
      }

      // ArrowLeft - Move selected annotation left OR go to previous page
      if (e.key === "ArrowLeft" && !mod && pdfFile) {
        e.preventDefault();
        if (selectedId && !editingId) {
          // Move selected annotation left by small amount
          const ann = annotationsRef.current.find((a) => a.id === selectedId);
          if (ann && "xRatio" in ann) {
            const newX = Math.max(0.05, (ann.xRatio || 0) - 0.01);
            setAnnotations((prev) =>
              prev.map((a) =>
                a.id === selectedId ? { ...a, xRatio: newX } : a,
              ),
            );
          }
        } else if (currentPage > 1) {
          goToPrev();
        }
        return;
      }

      // ArrowUp - Move selected annotation up
      if (e.key === "ArrowUp" && !mod && pdfFile) {
        e.preventDefault();
        if (selectedId && !editingId) {
          const ann = annotationsRef.current.find((a) => a.id === selectedId);
          if (ann && "yRatio" in ann) {
            const newY = Math.max(0.05, (ann.yRatio || 0) - 0.01);
            setAnnotations((prev) =>
              prev.map((a) =>
                a.id === selectedId ? { ...a, yRatio: newY } : a,
              ),
            );
          }
        }
        return;
      }

      // ArrowDown - Move selected annotation down
      if (e.key === "ArrowDown" && !mod && pdfFile) {
        e.preventDefault();
        if (selectedId && !editingId) {
          const ann = annotationsRef.current.find((a) => a.id === selectedId);
          if (ann && "yRatio" in ann) {
            const newY = Math.min(0.95, (ann.yRatio || 0) + 0.01);
            setAnnotations((prev) =>
              prev.map((a) =>
                a.id === selectedId ? { ...a, yRatio: newY } : a,
              ),
            );
          }
        }
        return;
      }

      // R key - Rectangle mode
      if (e.key === "r" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setShapeType("rect");
        setMode(
          mode === "add-shape" && shapeType === "rect" ? "select" : "add-shape",
        );
        return;
      }

      // C key - Circle mode
      if (e.key === "c" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setShapeType("circle");
        setMode(
          mode === "add-shape" && shapeType === "circle"
            ? "select"
            : "add-shape",
        );
        return;
      }

      // L key - Line mode
      if (e.key === "l" && !mod && editingId === null && pdfFile) {
        e.preventDefault();
        setShapeType("line");
        setMode(
          mode === "add-shape" && shapeType === "line" ? "select" : "add-shape",
        );
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedId,
    editingId,
    pdfFile,
    undo,
    redo,
    copySelected,
    cutSelected,
    pasteAnnotation,
    handleSave,
    deleteSelected,
    showSigModal,
    sigDrawing,
    sigUndo,
    sigRedo,
    mode,
    currentPage,
    totalPages,
    zoomIn,
    zoomOut,
    goToNext,
    goToPrev,
    shapeType,
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
            {/* Top bar */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileText
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium">
                  {pdfFile.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(pdfFile.size)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={handleClear}
                  aria-label="Close PDF"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrev}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[5rem] text-center text-sm tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNext}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addPage}
                  aria-label="Add page after current"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={deletePage}
                  aria-label="Delete current page"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={zoomOut}
                      disabled={scale <= SCALE_MIN}
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex items-center gap-2">
                      <span>Zoom out</span>
                      <Kbd>-</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <span className="min-w-[3.5rem] text-center text-sm tabular-nums">
                  {Math.round(scale * 100)}%
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={zoomIn}
                      disabled={scale >= SCALE_MAX}
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="flex items-center gap-2">
                      <span>Zoom in</span>
                      <Kbd>+</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={undo}
                      disabled={!canUndo}
                      aria-label="Undo"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      <span>Undo</span>
                      <KbdGroup>
                        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                        <Kbd>Z</Kbd>
                      </KbdGroup>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={redo}
                      disabled={!canRedo}
                      aria-label="Redo"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      <span>Redo</span>
                      <KbdGroup>
                        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                        <Kbd>Shift</Kbd>
                        <Kbd>Z</Kbd>
                      </KbdGroup>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => saveCurrentSession().catch(() => {})}
                      aria-label="Save session"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center gap-2">
                      <span>Save</span>
                      <KbdGroup>
                        <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                        <Kbd>S</Kbd>
                      </KbdGroup>
                    </div>
                  </TooltipContent>
                </Tooltip>
                {canShare && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    disabled={isSharing || !shareReady}
                    aria-label="Share PDF"
                    title={shareReady ? "Share PDF" : "Preparing…"}
                  >
                    <Share2
                      className={[
                        "h-4 w-4",
                        isSharing
                          ? "animate-pulse"
                          : !shareReady
                            ? "opacity-40"
                            : "",
                      ].join(" ")}
                    />
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  <Download className="h-3.5 w-3.5" />
                  {isExporting ? "Exporting…" : "Export PDF"}
                </Button>
                <span
                  className={`flex items-center gap-1 text-xs text-green-600 dark:text-green-400${!sessionSaved ? " invisible" : ""}`}
                >
                  <Save className="h-3 w-3" /> Saved
                </span>
              </div>

              {/* Mobile: properties + annotations drawer */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Properties"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="flex w-72 flex-col gap-0 overflow-y-auto p-0"
                >
                  <SheetTitle className="border-b px-4 py-3 text-sm font-semibold">
                    Properties
                  </SheetTitle>

                  {/* OCR language */}
                  {(mode === "area-ocr" || mode === "area-scan") && (
                    <div className="border-b p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        OCR language
                      </p>
                      <OcrLangSelect value={ocrLang} onChange={setOcrLang} />
                    </div>
                  )}

                  {/* Style properties */}
                  <div className="border-b p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {selectedIsShape
                        ? "Shape style"
                        : selectedIsDraw
                          ? "Stroke style"
                          : "Text style"}
                    </p>

                    {(selectedIsShape || mode === "add-shape") && (
                      <>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="text-xs text-muted-foreground">
                            Stroke
                          </label>
                          <ColorPicker
                            value={newStrokeColor}
                            onChange={setNewStrokeColor}
                            onBlur={(hex) =>
                              commitSelectedShapeUpdate({ strokeColor: hex })
                            }
                          />
                        </div>
                        {shapeType !== "line" &&
                          !(
                            selectedIsShape &&
                            (selectedAnn as ShapeAnnotation)?.shape === "line"
                          ) && (
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <label className="text-xs text-muted-foreground">
                                Fill
                              </label>
                              <div className="flex items-center gap-1">
                                <ColorPicker
                                  value={
                                    newFillColor === "none"
                                      ? "#ffffff"
                                      : newFillColor
                                  }
                                  disabled={newFillColor === "none"}
                                  onChange={setNewFillColor}
                                  onBlur={(hex) =>
                                    commitSelectedShapeUpdate({
                                      fillColor: hex,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  title={
                                    newFillColor === "none"
                                      ? "Enable fill"
                                      : "Remove fill"
                                  }
                                  onClick={() => {
                                    const next =
                                      newFillColor === "none"
                                        ? "#ffffff"
                                        : "none";
                                    setNewFillColor(next);
                                    commitSelectedShapeUpdate({
                                      fillColor: next,
                                    });
                                  }}
                                  className={[
                                    "flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors",
                                    newFillColor === "none"
                                      ? "bg-background text-muted-foreground hover:border-primary"
                                      : "bg-secondary text-foreground",
                                  ].join(" ")}
                                >
                                  {newFillColor === "none" ? "∅" : "✓"}
                                </button>
                              </div>
                            </div>
                          )}
                        <div
                          className={[
                            "flex items-center justify-between gap-2",
                            shapeType === "line" ||
                            (selectedIsShape &&
                              (selectedAnn as ShapeAnnotation)?.shape ===
                                "line")
                              ? "mb-2"
                              : "",
                          ].join(" ")}
                        >
                          <label className="text-xs text-muted-foreground">
                            Width
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={newStrokeWidth}
                            onChange={(e) =>
                              setNewStrokeWidth(Number(e.target.value))
                            }
                            onBlur={(e) =>
                              commitSelectedShapeUpdate({
                                strokeWidth: Number(e.target.value),
                              })
                            }
                            className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        {(shapeType === "line" ||
                          (selectedIsShape &&
                            (selectedAnn as ShapeAnnotation)?.shape ===
                              "line")) && (
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Arrows
                            </label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                title="Arrow at start"
                                onClick={() => {
                                  const v = !arrowStart;
                                  setArrowStart(v);
                                  commitSelectedShapeUpdate({ arrowStart: v });
                                }}
                                className={[
                                  "flex h-8 w-8 items-center justify-center rounded border text-sm font-bold transition-colors",
                                  arrowStart
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground hover:border-primary",
                                ].join(" ")}
                              >
                                {"<"}
                              </button>
                              <button
                                type="button"
                                title="Arrow at end"
                                onClick={() => {
                                  const v = !arrowEnd;
                                  setArrowEnd(v);
                                  commitSelectedShapeUpdate({ arrowEnd: v });
                                }}
                                className={[
                                  "flex h-8 w-8 items-center justify-center rounded border text-sm font-bold transition-colors",
                                  arrowEnd
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground hover:border-primary",
                                ].join(" ")}
                              >
                                {">"}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {(selectedIsDraw || mode === "draw") &&
                      !(selectedIsShape || mode === "add-shape") && (
                        <>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Color
                            </label>
                            <ColorPicker
                              value={newStrokeColor}
                              onChange={setNewStrokeColor}
                              onBlur={(hex) =>
                                commitSelectedShapeUpdate({ strokeColor: hex })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Width
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={newStrokeWidth}
                              onChange={(e) =>
                                setNewStrokeWidth(Number(e.target.value))
                              }
                              onBlur={(e) =>
                                commitSelectedShapeUpdate({
                                  strokeWidth: Number(e.target.value),
                                })
                              }
                              className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </>
                      )}

                    {!selectedIsShape &&
                      !selectedIsDraw &&
                      mode !== "add-shape" &&
                      mode !== "draw" && (
                        <>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Size
                            </label>
                            <input
                              type="number"
                              min={6}
                              max={96}
                              value={newFontSize}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setNewFontSize(v);
                                updateSelected({ fontSize: v });
                              }}
                              onBlur={(e) =>
                                commitSelectedUpdate({
                                  fontSize: Number(e.target.value),
                                })
                              }
                              className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Color
                            </label>
                            <ColorPicker
                              value={newColor}
                              onChange={(hex) => {
                                setNewColor(hex);
                                updateSelected({ color: hex });
                              }}
                              onBlur={(hex) =>
                                commitSelectedUpdate({ color: hex })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Background
                            </label>
                            <div className="flex items-center gap-1">
                              <ColorPicker
                                value={
                                  newBgColor === "none" ? "#ffffff" : newBgColor
                                }
                                disabled={newBgColor === "none"}
                                onChange={(hex) => {
                                  setNewBgColor(hex);
                                  updateSelected({ bgColor: hex });
                                }}
                                onBlur={(hex) =>
                                  commitSelectedUpdate({ bgColor: hex })
                                }
                              />
                              <button
                                type="button"
                                title={
                                  newBgColor === "none"
                                    ? "Enable background"
                                    : "Remove background"
                                }
                                onClick={() => {
                                  const next =
                                    newBgColor === "none" ? "#ffffff" : "none";
                                  setNewBgColor(next);
                                  updateSelected({ bgColor: next });
                                }}
                                className={[
                                  "flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors",
                                  newBgColor === "none"
                                    ? "bg-background text-muted-foreground hover:border-primary"
                                    : "bg-secondary text-foreground",
                                ].join(" ")}
                              >
                                {newBgColor === "none" ? "∅" : "✓"}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                  </div>

                  {/* Annotation list */}
                  <div className="flex-1 overflow-y-auto p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Annotations
                      {annotations.length > 0 && (
                        <span className="ml-1 font-normal normal-case">
                          ({annotations.length})
                        </span>
                      )}
                    </p>
                    {annotations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No annotations yet.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {annotations.map((ann) => (
                          <li key={ann.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(ann.id);
                                setCurrentPage(ann.page);
                              }}
                              className={[
                                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                                ann.id === selectedId
                                  ? "bg-muted font-medium"
                                  : "",
                              ].join(" ")}
                            >
                              {isSignature(ann) ? (
                                <PenLine className="h-3 w-3 shrink-0 text-muted-foreground" />
                              ) : isImage(ann) ? (
                                <img
                                  src={ann.dataUrl}
                                  alt=""
                                  className="h-4 w-4 shrink-0 rounded object-contain"
                                />
                              ) : isShape(ann) ? (
                                ann.shape === "line" ? (
                                  <Minus
                                    className="h-3 w-3 shrink-0"
                                    style={{ color: ann.strokeColor }}
                                  />
                                ) : ann.shape === "circle" ? (
                                  <Circle
                                    className="h-3 w-3 shrink-0"
                                    style={{ color: ann.strokeColor }}
                                  />
                                ) : (
                                  <Square
                                    className="h-3 w-3 shrink-0"
                                    style={{ color: ann.strokeColor }}
                                  />
                                )
                              ) : isDraw(ann) ? (
                                <PencilLine
                                  className="h-3 w-3 shrink-0"
                                  style={{ color: ann.strokeColor }}
                                />
                              ) : (
                                <span
                                  className="h-3 w-3 shrink-0 rounded-sm border"
                                  style={{ backgroundColor: ann.color }}
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate">
                                {isSignature(ann)
                                  ? "Signature"
                                  : isImage(ann)
                                    ? ann.label
                                    : isShape(ann)
                                      ? ann.shape === "line"
                                        ? "Line"
                                        : ann.shape
                                      : isDraw(ann)
                                        ? "Drawing"
                                        : ann.text}
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                p{ann.page}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full gap-1.5 text-destructive hover:text-destructive"
                        onClick={deleteSelected}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete selected
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Three-column layout */}
            <div className="flex gap-3">
              {/* ---- LEFT: Tools ---- */}

              {/* Mobile: hamburger opens a Sheet drawer */}
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Open tools"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-56 p-3">
                    <div className="flex flex-col gap-1">
                      <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Tools
                      </span>

                      <Button
                        variant={mode === "select" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => setMode("select")}
                      >
                        <MousePointer className="h-4 w-4" /> Select
                      </Button>
                      <Button
                        variant={mode === "add-text" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => setMode("add-text")}
                        title="Add text (T)"
                      >
                        <Type className="h-4 w-4" /> Text
                      </Button>
                      <Button
                        variant={mode === "area-scan" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => setMode("area-scan")}
                      >
                        <ScanLine className="h-4 w-4" /> Scan
                      </Button>
                      <Button
                        variant={mode === "area-ocr" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => setMode("area-ocr")}
                      >
                        <CaseSensitive className="h-4 w-4" /> OCR Area
                      </Button>
                      <Button
                        variant={
                          pageOcrStatus === "running" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="w-full justify-start gap-2"
                        disabled={pageOcrStatus === "running"}
                        onClick={handlePageOcr}
                      >
                        <FileSearch
                          className={[
                            "h-4 w-4",
                            pageOcrStatus === "running" ? "animate-pulse" : "",
                          ].join(" ")}
                        />{" "}
                        Read Page
                      </Button>

                      <div className="my-1 h-px w-full bg-border" />

                      <Button
                        variant={mode === "add-qr" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() =>
                          setMode(mode === "add-qr" ? "select" : "add-qr")
                        }
                        title="Add QR code (Q)"
                      >
                        <QrCode className="h-4 w-4" /> QR Code
                      </Button>
                      <Button
                        variant={mode === "add-barcode" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() =>
                          setMode(
                            mode === "add-barcode" ? "select" : "add-barcode",
                          )
                        }
                        title="Add barcode (B)"
                      >
                        <Barcode className="h-4 w-4" /> Barcode
                      </Button>

                      <div className="my-1 h-px w-full bg-border" />

                      <Button
                        variant={mode === "add-shape" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() =>
                          setMode(mode === "add-shape" ? "select" : "add-shape")
                        }
                        title="Add shape (R/C/L)"
                      >
                        <Shapes className="h-4 w-4" /> Shape
                      </Button>
                      {mode === "add-shape" && (
                        <div className="ml-6 flex gap-1">
                          <Button
                            variant={
                              shapeType === "rect" ? "secondary" : "ghost"
                            }
                            size="icon"
                            title="Rectangle (R)"
                            onClick={() => setShapeType("rect")}
                            className="h-7 w-7"
                          >
                            <Square className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={
                              shapeType === "circle" ? "secondary" : "ghost"
                            }
                            size="icon"
                            title="Circle (C)"
                            onClick={() => setShapeType("circle")}
                            className="h-7 w-7"
                          >
                            <Circle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={
                              shapeType === "line" ? "secondary" : "ghost"
                            }
                            size="icon"
                            title="Line / Arrow (L)"
                            onClick={() => setShapeType("line")}
                            className="h-7 w-7"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      <Button
                        variant={mode === "draw" ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() =>
                          setMode(mode === "draw" ? "select" : "draw")
                        }
                      >
                        <Pencil className="h-4 w-4" /> Draw
                      </Button>
                      <Button
                        variant={
                          mode === "add-signature" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          setMode("add-signature");
                          setShowSigModal(true);
                        }}
                      >
                        <PenLine className="h-4 w-4" /> Signature
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={handleImageUpload}
                        title="Add image (I)"
                      >
                        <Image className="h-4 w-4" /> Image
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Desktop: permanent vertical icon strip */}
              <aside className="hidden w-14 flex-col items-center gap-1 rounded-lg border bg-card p-1.5 lg:flex">
                <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tools
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "select" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Select mode"
                      onClick={() => setMode("select")}
                      className="h-9 w-9"
                    >
                      <MousePointer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Select / move</span>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "add-text" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Add text"
                      onClick={() => setMode("add-text")}
                      className="h-9 w-9"
                    >
                      <Type className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Add text</span>
                      <Kbd>T</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "area-scan" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Scan QR/barcode"
                      onClick={() => setMode("area-scan")}
                      className="h-9 w-9"
                    >
                      <ScanLine className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Scan area for QR / barcode
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "area-ocr" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="OCR text extraction"
                      onClick={() => setMode("area-ocr")}
                      className="h-9 w-9"
                    >
                      <CaseSensitive className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Extract text with OCR
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        pageOcrStatus === "running" ? "secondary" : "ghost"
                      }
                      size="icon"
                      aria-label="Full-page OCR"
                      disabled={pageOcrStatus === "running"}
                      onClick={handlePageOcr}
                      className="h-9 w-9"
                    >
                      <FileSearch
                        className={[
                          "h-4 w-4",
                          pageOcrStatus === "running" ? "animate-pulse" : "",
                        ].join(" ")}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Extract all text from page
                  </TooltipContent>
                </Tooltip>

                <div className="my-0.5 h-px w-full bg-border" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "add-qr" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Generate QR code"
                      onClick={() =>
                        setMode(mode === "add-qr" ? "select" : "add-qr")
                      }
                      className="h-9 w-9"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Insert QR code</span>
                      <Kbd>Q</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "add-barcode" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Generate barcode"
                      onClick={() =>
                        setMode(
                          mode === "add-barcode" ? "select" : "add-barcode",
                        )
                      }
                      className="h-9 w-9"
                    >
                      <Barcode className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Insert barcode</span>
                      <Kbd>B</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <div className="my-0.5 h-px w-full bg-border" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "add-shape" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Draw shape"
                      onClick={() =>
                        setMode(mode === "add-shape" ? "select" : "add-shape")
                      }
                      className="h-9 w-9"
                    >
                      <Shapes className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Draw shape</span>
                      <Kbd>R</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Shape sub-tools — shown when add-shape is active */}
                {mode === "add-shape" && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={shapeType === "rect" ? "secondary" : "ghost"}
                          size="icon"
                          aria-label="Rectangle"
                          onClick={() => setShapeType("rect")}
                          className="h-7 w-7"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex items-center gap-2">
                          <span>Rectangle</span>
                          <Kbd>R</Kbd>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={
                            shapeType === "circle" ? "secondary" : "ghost"
                          }
                          size="icon"
                          aria-label="Circle"
                          onClick={() => setShapeType("circle")}
                          className="h-7 w-7"
                        >
                          <Circle className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex items-center gap-2">
                          <span>Circle / Ellipse</span>
                          <Kbd>C</Kbd>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={shapeType === "line" ? "secondary" : "ghost"}
                          size="icon"
                          aria-label="Line"
                          onClick={() => setShapeType("line")}
                          className="h-7 w-7"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex items-center gap-2">
                          <span>Line / Arrow</span>
                          <Kbd>L</Kbd>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "draw" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Freehand draw"
                      onClick={() =>
                        setMode(mode === "draw" ? "select" : "draw")
                      }
                      className="h-9 w-9"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Freehand draw</span>
                      <Kbd>F</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={mode === "add-signature" ? "secondary" : "ghost"}
                      size="icon"
                      aria-label="Add signature"
                      onClick={() => {
                        setMode("add-signature");
                        setShowSigModal(true);
                      }}
                      className="h-9 w-9"
                    >
                      <PenLine className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Add signature</span>
                      <Kbd>S</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Add image"
                      onClick={handleImageUpload}
                      className="h-9 w-9"
                    >
                      <Image className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>Add image</span>
                      <Kbd>I</Kbd>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </aside>

              {/* ---- CENTER: Canvas + hints ---- */}
              <div className="min-w-0 flex-1 space-y-2">
                {/* Mode hints */}
                {mode === "add-text" && (
                  <p className="text-center text-xs text-muted-foreground">
                    Click anywhere on the page to place a text element
                  </p>
                )}
                {mode === "area-scan" && (
                  <p
                    className={[
                      "text-center text-xs",
                      scanStatus === "found" || scanStatus === "ocr-found"
                        ? "text-green-600 dark:text-green-400"
                        : scanStatus === "notfound"
                          ? "text-amber-600 dark:text-amber-400"
                          : scanStatus === "scanning"
                            ? "text-muted-foreground animate-pulse"
                            : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {scanStatus === "found"
                      ? "QR/barcode detected — annotation added"
                      : scanStatus === "ocr-found"
                        ? "Text extracted via OCR — annotation added"
                        : scanStatus === "notfound"
                          ? "Nothing found in selection"
                          : scanStatus === "scanning"
                            ? "Scanning…"
                            : "Drag to select an area — detects QR/barcode or extracts text"}
                  </p>
                )}
                {mode === "area-ocr" && (
                  <p
                    className={[
                      "text-center text-xs",
                      scanStatus === "ocr-found"
                        ? "text-green-600 dark:text-green-400"
                        : scanStatus === "notfound"
                          ? "text-amber-600 dark:text-amber-400"
                          : scanStatus === "scanning"
                            ? "text-muted-foreground animate-pulse"
                            : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {scanStatus === "ocr-found"
                      ? "Text extracted — annotation added"
                      : scanStatus === "notfound"
                        ? "No text found in selection"
                        : scanStatus === "scanning"
                          ? "Recognising text…"
                          : "Drag to select an area to extract text with OCR"}
                  </p>
                )}
                {mode === "add-shape" && (
                  <p className="text-center text-xs text-muted-foreground">
                    Drag to draw a{" "}
                    {shapeType === "circle"
                      ? "circle / ellipse"
                      : shapeType === "line"
                        ? "line / arrow"
                        : "rectangle"}{" "}
                    — configure style in the panel
                  </p>
                )}
                {mode === "draw" && (
                  <p className="text-center text-xs text-muted-foreground">
                    Draw freehand — configure stroke color and width in the
                    panel
                  </p>
                )}

                {/* Full-page OCR result panel */}
                {pageOcrStatus !== "idle" && (
                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Page text (OCR)
                      </p>
                      <div className="flex items-center gap-1">
                        {pageOcrStatus === "done" && pageOcrText && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={handleOcrCopy}
                            title="Copy to clipboard"
                          >
                            {ocrCopied ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => {
                            setPageOcrStatus("idle");
                            setPageOcrText("");
                          }}
                          title="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {pageOcrStatus === "running" && (
                      <p className="animate-pulse text-xs text-muted-foreground">
                        Recognising text on page {currentPage}…
                      </p>
                    )}
                    {pageOcrStatus === "error" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        No text found on this page.
                      </p>
                    )}
                    {pageOcrStatus === "done" && pageOcrText && (
                      <textarea
                        readOnly
                        value={pageOcrText}
                        className="w-full resize-none rounded border bg-muted/40 px-2 py-1.5 text-xs font-mono leading-relaxed focus:outline-none"
                        rows={Math.min(12, pageOcrText.split("\n").length + 1)}
                      />
                    )}
                  </div>
                )}

                {/* Generator panel (QR / Barcode) */}
                {showGenPanel && (
                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {mode === "add-qr"
                        ? "Generate QR code"
                        : "Generate barcode"}
                    </p>
                    {mode === "add-barcode" && (
                      <select
                        value={genBarcodeFormat}
                        onChange={(e) => setGenBarcodeFormat(e.target.value)}
                        className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {[
                          "CODE128",
                          "CODE39",
                          "EAN13",
                          "EAN8",
                          "UPC",
                          "ITF14",
                          "MSI",
                          "pharmacode",
                          "codabar",
                        ].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      placeholder={
                        mode === "add-qr"
                          ? "https://example.com"
                          : "Enter barcode value"
                      }
                      value={genText}
                      onChange={(e) => setGenText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          mode === "add-qr"
                            ? placeQrCode()
                            : placeBarcodeImage();
                        }
                      }}
                      className="w-full rounded border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={
                        mode === "add-qr" ? placeQrCode : placeBarcodeImage
                      }
                      disabled={!genText.trim()}
                    >
                      {mode === "add-qr" ? (
                        <QrCode className="h-3.5 w-3.5" />
                      ) : (
                        <Barcode className="h-3.5 w-3.5" />
                      )}
                      Insert into PDF
                    </Button>
                  </div>
                )}

                {/* Canvas */}
                <div className="overflow-auto rounded-lg border bg-muted/30">
                  <div
                    className="relative mx-auto"
                    style={{ width: "fit-content" }}
                  >
                    <canvas
                      ref={canvasRef}
                      aria-label={`PDF page ${currentPage} of ${totalPages}`}
                      className="block"
                    />

                    {/* Overlay */}
                    <div
                      ref={overlayRef}
                      className={[
                        "absolute inset-0 select-none",
                        overlayCursor,
                      ].join(" ")}
                      style={
                        mode === "area-scan" ||
                        mode === "area-ocr" ||
                        mode === "add-shape" ||
                        mode === "draw"
                          ? { touchAction: "none" }
                          : undefined
                      }
                      onPointerDown={handleOverlayPointerDown}
                      onPointerMove={handleOverlayPointerMove}
                      onPointerUp={handleOverlayPointerUp}
                    >
                      {/* Rubber-band selection rect */}
                      {selectRect && (
                        <div
                          className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                          style={{
                            left: Math.min(selectRect.x1, selectRect.x2),
                            top: Math.min(selectRect.y1, selectRect.y2),
                            width: Math.abs(selectRect.x2 - selectRect.x1),
                            height: Math.abs(selectRect.y2 - selectRect.y1),
                          }}
                        />
                      )}

                      {/* Shape drag preview */}
                      {shapeRect &&
                        mode === "add-shape" &&
                        shapeType !== "line" && (
                          <div
                            className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                            style={{
                              left: Math.min(shapeRect.x1, shapeRect.x2),
                              top: Math.min(shapeRect.y1, shapeRect.y2),
                              width: Math.abs(shapeRect.x2 - shapeRect.x1),
                              height: Math.abs(shapeRect.y2 - shapeRect.y1),
                              borderRadius:
                                shapeType === "circle" ? "50%" : undefined,
                              borderColor: newStrokeColor,
                              backgroundColor:
                                newFillColor !== "none"
                                  ? `${newFillColor}33`
                                  : undefined,
                            }}
                          />
                        )}
                      {shapeRect &&
                        mode === "add-shape" &&
                        shapeType === "line" && (
                          <svg
                            className="pointer-events-none absolute inset-0 overflow-visible"
                            style={{ width: "100%", height: "100%" }}
                          >
                            <defs>
                              <marker
                                id="preview-arrow-end"
                                markerWidth="8"
                                markerHeight="8"
                                refX="6"
                                refY="4"
                                orient="auto"
                              >
                                <path
                                  d="M0,0 L8,4 L0,8 Z"
                                  fill={newStrokeColor}
                                />
                              </marker>
                              <marker
                                id="preview-arrow-start"
                                markerWidth="8"
                                markerHeight="8"
                                refX="2"
                                refY="4"
                                orient="auto"
                              >
                                <path
                                  d="M8,0 L0,4 L8,8 Z"
                                  fill={newStrokeColor}
                                />
                              </marker>
                            </defs>
                            <line
                              x1={shapeRect.x1}
                              y1={shapeRect.y1}
                              x2={shapeRect.x2}
                              y2={shapeRect.y2}
                              stroke={newStrokeColor}
                              strokeWidth={newStrokeWidth}
                              strokeLinecap="round"
                              markerEnd={
                                arrowEnd ? "url(#preview-arrow-end)" : undefined
                              }
                              markerStart={
                                arrowStart
                                  ? "url(#preview-arrow-start)"
                                  : undefined
                              }
                            />
                          </svg>
                        )}

                      {/* Freehand draw live preview */}
                      {mode === "draw" &&
                        livePoints.length >= 2 &&
                        (() => {
                          const cw =
                            canvasDimensions.width ||
                            canvasRef.current?.width ||
                            1;
                          const ch =
                            canvasDimensions.height ||
                            canvasRef.current?.height ||
                            1;
                          return (
                            <svg
                              className="pointer-events-none absolute inset-0"
                              width={cw}
                              height={ch}
                              style={{ overflow: "visible" }}
                            >
                              <polyline
                                points={livePoints
                                  .map((p) => `${p.x * cw},${p.y * ch}`)
                                  .join(" ")}
                                fill="none"
                                stroke={newStrokeColor}
                                strokeWidth={newStrokeWidth}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                              />
                            </svg>
                          );
                        })()}

                      {/* Annotations */}
                      {pageAnnotations.map((ann) => {
                        const w =
                          canvasDimensions.width ||
                          canvasRef.current?.width ||
                          0;
                        const h =
                          canvasDimensions.height ||
                          canvasRef.current?.height ||
                          0;
                        const isSelected = ann.id === selectedId;
                        const isEditing = ann.id === editingId;

                        // Don't render annotations until canvas has valid dimensions
                        if (w === 0 || h === 0) return null;

                        if (isShape(ann)) {
                          if (ann.shape === "line") {
                            const x1 = ann.xRatio * w;
                            const y1 = ann.yRatio * h;
                            const x2 = (ann.x2Ratio ?? ann.xRatio) * w;
                            const y2 = (ann.y2Ratio ?? ann.yRatio) * h;
                            const mid = `arrow-${ann.id}`;
                            return (
                              <svg
                                key={ann.id}
                                className="absolute inset-0 overflow-visible"
                                style={{ width: w, height: h }}
                              >
                                <defs>
                                  <marker
                                    id={mid}
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="6"
                                    refY="4"
                                    orient="auto"
                                  >
                                    <path
                                      d="M0,0 L8,4 L0,8 Z"
                                      fill={ann.strokeColor}
                                    />
                                  </marker>
                                  <marker
                                    id={`${mid}-rev`}
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="2"
                                    refY="4"
                                    orient="auto"
                                  >
                                    <path
                                      d="M8,0 L0,4 L8,8 Z"
                                      fill={ann.strokeColor}
                                    />
                                  </marker>
                                </defs>
                                {/* Wide transparent hit area */}
                                <line
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke="transparent"
                                  strokeWidth={Math.max(ann.strokeWidth, 14)}
                                  style={{
                                    pointerEvents: "stroke",
                                    cursor: "move",
                                  }}
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    handleAnnotationPointerDown(
                                      e as React.PointerEvent,
                                      ann.id,
                                    );
                                  }}
                                  onPointerMove={(e) => {
                                    handleAnnotationPointerMove(
                                      e as React.PointerEvent,
                                    );
                                    handleResizePointerMove(
                                      e as React.PointerEvent,
                                    );
                                  }}
                                  onPointerUp={() => {
                                    handleAnnotationPointerUp();
                                    handleResizePointerUp();
                                  }}
                                />
                                <line
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke={ann.strokeColor}
                                  strokeWidth={ann.strokeWidth}
                                  strokeLinecap="round"
                                  markerEnd={
                                    ann.arrowEnd ? `url(#${mid})` : undefined
                                  }
                                  markerStart={
                                    ann.arrowStart
                                      ? `url(#${mid}-rev)`
                                      : undefined
                                  }
                                  style={{ pointerEvents: "none" }}
                                />
                                {isSelected && (
                                  <>
                                    <circle
                                      cx={x1}
                                      cy={y1}
                                      r={6}
                                      fill="white"
                                      stroke="hsl(var(--primary))"
                                      strokeWidth={2}
                                      style={{
                                        pointerEvents: "all",
                                        cursor: "crosshair",
                                      }}
                                      onPointerDown={(e) =>
                                        handleLineEndpointDown(
                                          e,
                                          ann.id,
                                          "start",
                                        )
                                      }
                                    />
                                    <circle
                                      cx={x2}
                                      cy={y2}
                                      r={6}
                                      fill="white"
                                      stroke="hsl(var(--primary))"
                                      strokeWidth={2}
                                      style={{
                                        pointerEvents: "all",
                                        cursor: "crosshair",
                                      }}
                                      onPointerDown={(e) =>
                                        handleLineEndpointDown(e, ann.id, "end")
                                      }
                                    />
                                  </>
                                )}
                              </svg>
                            );
                          }

                          const left = ann.xRatio * w;
                          const top = ann.yRatio * h;
                          const shapeW = ann.wRatio * w;
                          const shapeH = ann.hRatio * h;
                          return (
                            <div
                              key={ann.id}
                              style={{
                                position: "absolute",
                                left,
                                top,
                                width: shapeW,
                                height: shapeH,
                                border: `${ann.strokeWidth}px solid ${ann.strokeColor}`,
                                backgroundColor:
                                  ann.fillColor === "none"
                                    ? undefined
                                    : ann.fillColor,
                                borderRadius:
                                  ann.shape === "circle" ? "50%" : undefined,
                                cursor: "move",
                                boxSizing: "border-box",
                              }}
                              className={
                                isSelected
                                  ? "outline outline-2 outline-offset-2 outline-primary"
                                  : ""
                              }
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                handleAnnotationPointerDown(e, ann.id);
                              }}
                              onPointerMove={(e) => {
                                handleAnnotationPointerMove(e);
                                handleResizePointerMove(e);
                              }}
                              onPointerUp={() => {
                                handleAnnotationPointerUp();
                                handleResizePointerUp();
                              }}
                            >
                              {isSelected &&
                                (() => {
                                  const bg =
                                    ann.fillColor !== "none"
                                      ? ann.fillColor
                                      : ann.strokeColor;
                                  return (
                                    <div
                                      style={{
                                        position: "absolute",
                                        right: -5,
                                        bottom: -5,
                                        width: 14,
                                        height: 14,
                                        cursor: "se-resize",
                                        backgroundColor: bg,
                                        borderColor: contrastColor(bg),
                                      }}
                                      className="rounded-sm border-2"
                                      onPointerDown={(e) =>
                                        handleResizePointerDown(e, ann.id)
                                      }
                                      onPointerMove={handleResizePointerMove}
                                      onPointerUp={handleResizePointerUp}
                                    />
                                  );
                                })()}
                            </div>
                          );
                        }

                        if (isDraw(ann)) {
                          const xs = ann.points.map((p) => p.x * w);
                          const ys = ann.points.map((p) => p.y * h);
                          const pad = ann.strokeWidth + 6;
                          const minX = Math.min(...xs) - pad;
                          const minY = Math.min(...ys) - pad;
                          const maxX = Math.max(...xs) + pad;
                          const maxY = Math.max(...ys) + pad;
                          const svgW = maxX - minX;
                          const svgH = maxY - minY;
                          const pts = ann.points
                            .map((p) => `${p.x * w - minX},${p.y * h - minY}`)
                            .join(" ");
                          return (
                            <svg
                              key={ann.id}
                              style={{
                                position: "absolute",
                                left: minX,
                                top: minY,
                                width: svgW,
                                height: svgH,
                                overflow: "visible",
                                cursor: "move",
                              }}
                              className={
                                isSelected
                                  ? "outline outline-2 outline-offset-2 outline-primary rounded"
                                  : ""
                              }
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                handleAnnotationPointerDown(e, ann.id);
                              }}
                              onPointerMove={handleAnnotationPointerMove}
                              onPointerUp={handleAnnotationPointerUp}
                            >
                              <polyline
                                points={pts}
                                fill="none"
                                stroke={ann.strokeColor}
                                strokeWidth={ann.strokeWidth}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                              />
                              {/* Wide transparent hit area so thin lines stay clickable */}
                              <polyline
                                points={pts}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={Math.max(ann.strokeWidth, 14)}
                              />
                            </svg>
                          );
                        }

                        if (isSignature(ann)) {
                          const left = ann.xRatio * w;
                          const top = ann.yRatio * h;
                          const sigW = ann.wRatio * w;
                          const sigH = ann.hRatio * h;
                          return (
                            <div
                              key={ann.id}
                              style={{
                                position: "absolute",
                                left,
                                top,
                                width: sigW,
                                height: sigH,
                                cursor: "move",
                              }}
                              className={
                                isSelected
                                  ? "outline outline-2 outline-offset-2 outline-primary"
                                  : ""
                              }
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                handleAnnotationPointerDown(e, ann.id);
                              }}
                              onPointerMove={(e) => {
                                handleAnnotationPointerMove(e);
                                handleResizePointerMove(e);
                              }}
                              onPointerUp={() => {
                                handleAnnotationPointerUp();
                                handleResizePointerUp();
                              }}
                            >
                              <img
                                src={ann.dataUrl}
                                alt="Signature"
                                draggable={false}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "block",
                                  objectFit: "contain",
                                  pointerEvents: "none",
                                }}
                              />
                              {isSelected && (
                                <div
                                  style={{
                                    position: "absolute",
                                    right: -5,
                                    bottom: -5,
                                    width: 14,
                                    height: 14,
                                    cursor: "se-resize",
                                    backgroundColor: "#ffffff",
                                    borderColor: "#222222",
                                  }}
                                  className="rounded-sm border-2"
                                  onPointerDown={(e) =>
                                    handleResizePointerDown(e, ann.id)
                                  }
                                  onPointerMove={handleResizePointerMove}
                                  onPointerUp={handleResizePointerUp}
                                />
                              )}
                            </div>
                          );
                        }

                        if (isImage(ann)) {
                          const left = ann.xRatio * w;
                          const top = ann.yRatio * h;
                          const imgW = ann.wRatio * w;
                          const imgH = ann.hRatio * h;
                          return (
                            <div
                              key={ann.id}
                              style={{
                                position: "absolute",
                                left,
                                top,
                                width: imgW,
                                height: imgH,
                                cursor: "move",
                              }}
                              className={
                                isSelected
                                  ? "outline outline-2 outline-offset-2 outline-primary"
                                  : ""
                              }
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                handleAnnotationPointerDown(e, ann.id);
                              }}
                              onPointerMove={(e) => {
                                handleAnnotationPointerMove(e);
                                handleResizePointerMove(e);
                              }}
                              onPointerUp={() => {
                                handleAnnotationPointerUp();
                                handleResizePointerUp();
                              }}
                            >
                              <img
                                src={ann.dataUrl}
                                alt={ann.label}
                                draggable={false}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "block",
                                  pointerEvents: "none",
                                }}
                              />
                              {/* Resize handle — bottom-right corner */}
                              {isSelected && (
                                <div
                                  style={{
                                    position: "absolute",
                                    right: -5,
                                    bottom: -5,
                                    width: 14,
                                    height: 14,
                                    cursor: "se-resize",
                                    backgroundColor: "#ffffff",
                                    borderColor: "#222222",
                                  }}
                                  className="rounded-sm border-2"
                                  onPointerDown={(e) =>
                                    handleResizePointerDown(e, ann.id)
                                  }
                                  onPointerMove={handleResizePointerMove}
                                  onPointerUp={handleResizePointerUp}
                                />
                              )}
                            </div>
                          );
                        }

                        const left = ann.xRatio * w;
                        const top = ann.yRatio * h;
                        return (
                          <div
                            key={ann.id}
                            style={{
                              left,
                              top,
                              position: "absolute",
                              fontSize: ann.fontSize * scale,
                              fontFamily: ann.fontFamily ?? "Helvetica, Arial, sans-serif",
                              color: ann.color,
                              lineHeight: 1,
                              backgroundColor:
                                ann.bgColor === "none"
                                  ? undefined
                                  : ann.bgColor,
                            }}
                            className={[
                              "select-none touch-none",
                              isSelected
                                ? "outline outline-2 outline-offset-2 outline-primary"
                                : "",
                              !isEditing ? "cursor-move" : "",
                            ].join(" ")}
                            onPointerDown={(e) =>
                              handleAnnotationPointerDown(e, ann.id)
                            }
                            onPointerMove={handleAnnotationPointerMove}
                            onPointerUp={handleAnnotationPointerUp}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              preEditSnapshotRef.current =
                                annotationsRef.current;
                              setEditingId(ann.id);
                              setSelectedId(ann.id);
                            }}
                          >
                            {isEditing ? (
                              <input
                                // biome-ignore lint/a11y/noAutofocus: intentional — just placed
                                autoFocus
                                ref={(el) => {
                                  if (el && !el.dataset.initialized) {
                                    el.dataset.initialized = "true";
                                    setTimeout(() => {
                                      el.focus();
                                      el.select();
                                    }, 0);
                                  }
                                }}
                                value={ann.text}
                                onChange={(e) => {
                                  setAnnotations((prev) =>
                                    prev.map((a) =>
                                      a.id === ann.id
                                        ? ({
                                            ...a,
                                            text: e.target.value,
                                          } as TextAnnotation)
                                        : a,
                                    ),
                                  );
                                  setPanelText(e.target.value);
                                }}
                                onBlur={() => {
                                  if (preEditSnapshotRef.current) {
                                    pushHistory(
                                      annotationsRef.current,
                                      preEditSnapshotRef.current,
                                    );
                                    preEditSnapshotRef.current = null;
                                  }
                                  setEditingId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Escape")
                                    (e.target as HTMLInputElement).blur();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  fontSize: "inherit",
                                  color: "inherit",
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  width: Math.max(
                                    60,
                                    ann.text.length *
                                      0.65 *
                                      ann.fontSize *
                                      scale,
                                  ),
                                }}
                              />
                            ) : (
                              <span>{ann.text}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ---- RIGHT: Properties + Annotation list ---- */}
              <aside className="hidden w-56 shrink-0 lg:block">
                <div className="rounded-lg border bg-card">
                  {/* OCR language — shown when any OCR mode is active */}
                  {(mode === "area-ocr" || mode === "area-scan") && (
                    <div className="border-b p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        OCR language
                      </p>
                      <OcrLangSelect value={ocrLang} onChange={setOcrLang} />
                    </div>
                  )}

                  {/* Properties */}
                  <div className="border-b p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {selectedIsShape
                        ? "Shape style"
                        : selectedIsDraw
                          ? "Stroke style"
                          : "Text style"}
                    </p>

                    {/* Shape properties */}
                    {(selectedIsShape || mode === "add-shape") && (
                      <>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="text-xs text-muted-foreground">
                            Stroke
                          </label>
                          <ColorPicker
                            value={newStrokeColor}
                            onChange={setNewStrokeColor}
                            onBlur={(hex) =>
                              commitSelectedShapeUpdate({ strokeColor: hex })
                            }
                          />
                        </div>
                        {shapeType !== "line" &&
                          !(
                            selectedIsShape &&
                            (selectedAnn as ShapeAnnotation)?.shape === "line"
                          ) && (
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <label className="text-xs text-muted-foreground">
                                Fill
                              </label>
                              <div className="flex items-center gap-1">
                                <ColorPicker
                                  value={
                                    newFillColor === "none"
                                      ? "#ffffff"
                                      : newFillColor
                                  }
                                  disabled={newFillColor === "none"}
                                  onChange={setNewFillColor}
                                  onBlur={(hex) =>
                                    commitSelectedShapeUpdate({
                                      fillColor: hex,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  title={
                                    newFillColor === "none"
                                      ? "Enable fill"
                                      : "Remove fill"
                                  }
                                  onClick={() => {
                                    const next =
                                      newFillColor === "none"
                                        ? "#ffffff"
                                        : "none";
                                    setNewFillColor(next);
                                    commitSelectedShapeUpdate({
                                      fillColor: next,
                                    });
                                  }}
                                  className={[
                                    "flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors",
                                    newFillColor === "none"
                                      ? "bg-background text-muted-foreground hover:border-primary"
                                      : "bg-secondary text-foreground",
                                  ].join(" ")}
                                >
                                  {newFillColor === "none" ? "∅" : "✓"}
                                </button>
                              </div>
                            </div>
                          )}
                        <div
                          className={[
                            "flex items-center justify-between gap-2",
                            shapeType === "line" ||
                            (selectedIsShape &&
                              (selectedAnn as ShapeAnnotation)?.shape ===
                                "line")
                              ? "mb-2"
                              : "",
                          ].join(" ")}
                        >
                          <label className="text-xs text-muted-foreground">
                            Width
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={newStrokeWidth}
                            onChange={(e) =>
                              setNewStrokeWidth(Number(e.target.value))
                            }
                            onBlur={(e) =>
                              commitSelectedShapeUpdate({
                                strokeWidth: Number(e.target.value),
                              })
                            }
                            className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        {(shapeType === "line" ||
                          (selectedIsShape &&
                            (selectedAnn as ShapeAnnotation)?.shape ===
                              "line")) && (
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Arrows
                            </label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                title="Arrow at start"
                                onClick={() => {
                                  const v = !arrowStart;
                                  setArrowStart(v);
                                  commitSelectedShapeUpdate({ arrowStart: v });
                                }}
                                className={[
                                  "flex h-8 w-8 items-center justify-center rounded border text-sm font-bold transition-colors",
                                  arrowStart
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground hover:border-primary",
                                ].join(" ")}
                              >
                                {"<"}
                              </button>
                              <button
                                type="button"
                                title="Arrow at end"
                                onClick={() => {
                                  const v = !arrowEnd;
                                  setArrowEnd(v);
                                  commitSelectedShapeUpdate({ arrowEnd: v });
                                }}
                                className={[
                                  "flex h-8 w-8 items-center justify-center rounded border text-sm font-bold transition-colors",
                                  arrowEnd
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground hover:border-primary",
                                ].join(" ")}
                              >
                                {">"}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Draw properties */}
                    {(selectedIsDraw || mode === "draw") &&
                      !(selectedIsShape || mode === "add-shape") && (
                        <>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Color
                            </label>
                            <ColorPicker
                              value={newStrokeColor}
                              onChange={setNewStrokeColor}
                              onBlur={(hex) =>
                                commitSelectedShapeUpdate({ strokeColor: hex })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Width
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={newStrokeWidth}
                              onChange={(e) =>
                                setNewStrokeWidth(Number(e.target.value))
                              }
                              onBlur={(e) =>
                                commitSelectedShapeUpdate({
                                  strokeWidth: Number(e.target.value),
                                })
                              }
                              className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </>
                      )}

                    {/* Text properties */}
                    {!selectedIsShape &&
                      !selectedIsDraw &&
                      mode !== "add-shape" &&
                      mode !== "draw" &&
                      selectedAnn &&
                      !isImage(selectedAnn) && (
                        <>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label
                              htmlFor="text-content"
                              className="text-xs text-muted-foreground"
                            >
                              Text
                            </label>
                            <input
                              id="text-content"
                              type="text"
                              value={panelText}
                              onChange={(e) => {
                                setPanelText(e.target.value);
                                updateSelected({ text: e.target.value });
                              }}
                              onBlur={(e) =>
                                commitSelectedUpdate({ text: e.target.value })
                              }
                              placeholder="Enter text..."
                              className="w-28 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Font
                            </label>
                            <div className="w-28">
                              <FontSelect
                                value={(selectedAnn as TextAnnotation)?.fontFamily ?? "helvetica"}
                                onChange={(fontFamily) => {
                                  updateSelected({ fontFamily });
                                  commitSelectedUpdate({ fontFamily });
                                }}
                              />
                            </div>
                          </div>

                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label
                              htmlFor="font-size"
                              className="text-xs text-muted-foreground"
                            >
                              Size
                            </label>
                            <input
                              id="font-size"
                              type="number"
                              min={6}
                              max={96}
                              value={newFontSize}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setNewFontSize(v);
                                updateSelected({ fontSize: v });
                              }}
                              onBlur={(e) =>
                                commitSelectedUpdate({
                                  fontSize: Number(e.target.value),
                                })
                              }
                              className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Color
                            </label>
                            <ColorPicker
                              value={newColor}
                              onChange={(hex) => {
                                setNewColor(hex);
                                updateSelected({ color: hex });
                              }}
                              onBlur={(hex) =>
                                commitSelectedUpdate({ color: hex })
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs text-muted-foreground">
                              Background
                            </label>
                            <div className="flex items-center gap-1">
                              <ColorPicker
                                value={
                                  newBgColor === "none" ? "#ffffff" : newBgColor
                                }
                                disabled={newBgColor === "none"}
                                onChange={(hex) => {
                                  setNewBgColor(hex);
                                  updateSelected({ bgColor: hex });
                                }}
                                onBlur={(hex) =>
                                  commitSelectedUpdate({ bgColor: hex })
                                }
                              />
                              <button
                                type="button"
                                title={
                                  newBgColor === "none"
                                    ? "Enable background"
                                    : "Remove background"
                                }
                                onClick={() => {
                                  const next =
                                    newBgColor === "none" ? "#ffffff" : "none";
                                  setNewBgColor(next);
                                  updateSelected({ bgColor: next });
                                }}
                                className={[
                                  "flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors",
                                  newBgColor === "none"
                                    ? "bg-background text-muted-foreground hover:border-primary"
                                    : "bg-secondary text-foreground",
                                ].join(" ")}
                              >
                                {newBgColor === "none" ? "∅" : "✓"}
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                    {/* QR/Barcode properties - only show for generated codes, not uploaded images */}
                    {selectedAnn &&
                      isImage(selectedAnn) &&
                      "label" in selectedAnn &&
                      (selectedAnn.label?.includes("QR") ||
                        selectedAnn.label?.includes("Barcode") ||
                        selectedAnn.label?.includes("EAN") ||
                        selectedAnn.label?.includes("UPC") ||
                        selectedAnn.label?.includes("CODE")) && (
                        <div className="mb-2">
                          <label className="mb-1.5 block text-xs text-muted-foreground">
                            {selectedAnn.label?.includes("QR")
                              ? "QR Code Content"
                              : "Barcode Content"}
                          </label>
                          <input
                            type="text"
                            value={
                              selectedAnn.label
                                ?.replace("QR: ", "")
                                .replace("Barcode: ", "") || ""
                            }
                            onChange={(e) => {
                              const newText = e.target.value;
                              const label = selectedAnn.label?.includes("QR")
                                ? `QR: ${newText}`
                                : `Barcode: ${newText}`;
                              setAnnotations((prev) =>
                                prev.map((a) =>
                                  a.id === selectedAnn.id
                                    ? ({ ...a, label } as ImageAnnotation)
                                    : a,
                                ),
                              );
                            }}
                            onBlur={() => {
                              // Regenerate QR/barcode image
                              const regenerateImage = async () => {
                                if (!selectedAnn || !("label" in selectedAnn))
                                  return;
                                const text =
                                  selectedAnn.label
                                    ?.replace("QR: ", "")
                                    .replace("Barcode: ", "") || "";

                                if (selectedAnn.label?.includes("QR")) {
                                  // Regenerate QR code
                                  const QRCode = (await import("qrcode"))
                                    .default;
                                  const offscreen =
                                    document.createElement("canvas");
                                  await QRCode.toCanvas(offscreen, text, {
                                    width: 200,
                                    errorCorrectionLevel: "M",
                                  });
                                  const dataUrl =
                                    offscreen.toDataURL("image/png");
                                  setAnnotations((prev) =>
                                    prev.map((a) =>
                                      a.id === selectedAnn.id
                                        ? ({ ...a, dataUrl } as ImageAnnotation)
                                        : a,
                                    ),
                                  );
                                } else {
                                  // Regenerate barcode
                                  const JsBarcode = (await import("jsbarcode"))
                                    .default;
                                  const offscreen =
                                    document.createElement("canvas");
                                  JsBarcode(offscreen, text, {
                                    format: "CODE128",
                                    width: 2,
                                    height: 80,
                                    displayValue: true,
                                    fontSize: 14,
                                  });
                                  const dataUrl =
                                    offscreen.toDataURL("image/png");
                                  setAnnotations((prev) =>
                                    prev.map((a) =>
                                      a.id === selectedAnn.id
                                        ? ({ ...a, dataUrl } as ImageAnnotation)
                                        : a,
                                    ),
                                  );
                                }
                              };
                              regenerateImage().catch(() => {});
                            }}
                            className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder={
                              selectedAnn.label?.includes("QR")
                                ? "Enter text or URL"
                                : "Enter barcode value"
                            }
                          />
                        </div>
                      )}

                    {/* Image source - show for uploaded images (not QR/barcodes) */}
                    {selectedAnn &&
                      isImage(selectedAnn) &&
                      "label" in selectedAnn &&
                      !selectedAnn.label?.includes("QR") &&
                      !selectedAnn.label?.includes("Barcode") &&
                      !selectedAnn.label?.includes("EAN") &&
                      !selectedAnn.label?.includes("UPC") && (
                        <div className="mb-2">
                          <label className="mb-1.5 block text-xs text-muted-foreground">
                            Source
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="flex-1 truncate text-xs text-foreground">
                              {selectedAnn.label}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleImageReplace(selectedAnn.id)}
                              className="shrink-0 text-xs"
                            >
                              Replace
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Annotation list */}
                  <div className="p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Annotations
                      {annotations.length > 0 && (
                        <span className="ml-1 font-normal normal-case">
                          ({annotations.length})
                        </span>
                      )}
                    </p>

                    {annotations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No annotations yet.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {annotations.map((ann) => (
                          <li key={ann.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(ann.id);
                                setCurrentPage(ann.page);
                              }}
                              className={[
                                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                                ann.id === selectedId
                                  ? "bg-muted font-medium"
                                  : "",
                              ].join(" ")}
                            >
                              {isSignature(ann) ? (
                                <PenLine className="h-3 w-3 shrink-0 text-muted-foreground" />
                              ) : isImage(ann) ? (
                                <img
                                  src={ann.dataUrl}
                                  alt=""
                                  className="h-4 w-4 shrink-0 rounded object-contain"
                                />
                              ) : isShape(ann) ? (
                                ann.shape === "line" ? (
                                  <Minus
                                    className="h-3 w-3 shrink-0"
                                    style={{ color: ann.strokeColor }}
                                  />
                                ) : ann.shape === "circle" ? (
                                  <Circle
                                    className="h-3 w-3 shrink-0"
                                    style={{ color: ann.strokeColor }}
                                  />
                                ) : (
                                  <Square
                                    className="h-3 w-3 shrink-0"
                                    style={{ color: ann.strokeColor }}
                                  />
                                )
                              ) : isDraw(ann) ? (
                                <PencilLine
                                  className="h-3 w-3 shrink-0"
                                  style={{ color: ann.strokeColor }}
                                />
                              ) : (
                                <span
                                  className="h-3 w-3 shrink-0 rounded-sm border"
                                  style={{ backgroundColor: ann.color }}
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate">
                                {isSignature(ann)
                                  ? "Signature"
                                  : isImage(ann)
                                    ? ann.label
                                    : isShape(ann)
                                      ? ann.shape === "line"
                                        ? "Line"
                                        : ann.shape
                                      : isDraw(ann)
                                        ? "Drawing"
                                        : ann.text}
                              </span>
                              <span className="shrink-0 text-muted-foreground">
                                p{ann.page}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {selectedId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full gap-1.5 text-destructive hover:text-destructive"
                        onClick={deleteSelected}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete selected
                      </Button>
                    )}
                  </div>
                </div>
              </aside>
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

        {/* Signature modal */}
        {showSigModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSigModal(false);
                setMode("select");
              }
            }}
          >
            <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-sm font-semibold">Signature</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setShowSigModal(false);
                    setMode("select");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                <button
                  type="button"
                  onClick={() => setSigDrawing(false)}
                  className={[
                    "flex-1 py-2 text-sm font-medium transition-colors",
                    !sigDrawing
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  Saved
                </button>
                <button
                  type="button"
                  onClick={() => setSigDrawing(true)}
                  className={[
                    "flex-1 py-2 text-sm font-medium transition-colors",
                    sigDrawing
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  Draw new
                </button>
              </div>

              <div className="p-4">
                {/* Saved signatures tab */}
                {!sigDrawing && (
                  <>
                    {savedSignatures.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <PenLine className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No saved signatures yet.
                        </p>
                        <Button size="sm" onClick={() => setSigDrawing(true)}>
                          Draw your first signature
                        </Button>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {savedSignatures.map((sig) => (
                          <li
                            key={sig.id}
                            className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2"
                          >
                            <img
                              src={sig.dataUrl}
                              alt={sig.name}
                              className="h-10 w-24 shrink-0 rounded border bg-white object-contain"
                            />
                            {renamingId === sig.id ? (
                              <input
                                // biome-ignore lint/a11y/noAutofocus: intentional inline rename
                                autoFocus
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => commitRename(sig.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitRename(sig.id);
                                  }
                                  if (e.key === "Escape") setRenamingId(null);
                                }}
                                className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            ) : (
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {sig.name}
                              </span>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                              title="Rename"
                              onClick={() => {
                                setRenamingId(sig.id);
                                setRenameValue(sig.name);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => placeSignature(sig)}
                            >
                              Use
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteSignature(sig.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {/* Draw new tab */}
                {sigDrawing && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground shrink-0">
                        Name
                      </label>
                      <input
                        type="text"
                        value={sigName}
                        onChange={(e) => setSigName(e.target.value)}
                        placeholder="Signature name"
                        className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="overflow-hidden rounded-lg border bg-white">
                      <canvas
                        ref={sigCanvasRef}
                        width={420}
                        height={160}
                        className="block w-full touch-none cursor-crosshair"
                        style={{ touchAction: "none" }}
                        onPointerDown={handleSigPointerDown}
                        onPointerMove={handleSigPointerMove}
                        onPointerUp={handleSigPointerUp}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Draw your signature above
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={clearSigCanvas}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Clear
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={saveSignature}
                      >
                        Save signature
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
