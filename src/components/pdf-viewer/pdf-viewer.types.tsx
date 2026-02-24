"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Stored data interfaces (used by IDB layer in pdf-viewer-client.tsx)
// ---------------------------------------------------------------------------

export interface StoredHistory {
  sessionId: string;
  undoStack: Annotation[][];
  redoStack: Annotation[][];
}

export interface StoredSession {
  id: string;
  fileName: string;
  fileSize: number;
  savedAt: number;
  currentPage: number;
  totalPages: number;
  annotationCount: number;
  scale: number;
  annotations: Annotation[];
  fileBytes: ArrayBuffer;
}

export interface StoredSignature {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Editor types
// ---------------------------------------------------------------------------

export type Status = "idle" | "loading" | "ready" | "error";
export type EditorMode =
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

export interface TextAnnotation {
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

export interface ImageAnnotation {
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

export interface ShapeAnnotation {
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

export interface DrawAnnotation {
  id: string;
  page: number;
  points: { x: number; y: number }[];
  strokeColor: string;
  strokeWidth: number;
}

export interface SignatureAnnotation {
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

export type Annotation =
  | TextAnnotation
  | ImageAnnotation
  | ShapeAnnotation
  | DrawAnnotation
  | SignatureAnnotation;

/** Selection rect while rubber-banding */
export interface SelectRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isSignature(a: Annotation): a is SignatureAnnotation {
  return "sigId" in a;
}
export function isImage(a: Annotation): a is ImageAnnotation {
  return "dataUrl" in a && !isSignature(a);
}
export function isShape(a: Annotation): a is ShapeAnnotation {
  return "shape" in a;
}
export function isDraw(a: Annotation): a is DrawAnnotation {
  return "points" in a;
}
export function isText(a: Annotation): a is TextAnnotation {
  return (
    "text" in a && !isShape(a) && !isDraw(a) && !isImage(a) && !isSignature(a)
  );
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function parseHexToRgb01(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** Returns '#ffffff' or '#000000' — whichever contrasts better against the given hex color. */
export function contrastColor(hex: string): string {
  const { r, g, b } = parseHexToRgb01(hex);
  const lum = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCALE_MIN = 0.5;
export const SCALE_MAX = 3.0;
export const SCALE_STEP = 0.25;
export const DEFAULT_FONT_SIZE = 14;
export const DEFAULT_COLOR = "#000000";
export const DEFAULT_BG_COLOR = "none";

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const OCR_LANGUAGES = [
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

export const STANDARD_FONTS = [
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

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------

export function FontSelect({
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

export function OcrLangSelect({
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
