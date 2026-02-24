"use client";

import React from "react";
import {
  MousePointer,
  Type,
  ScanLine,
  QrCode,
  Barcode,
  Shapes,
  Square,
  Circle,
  Pencil,
  PenLine,
  Minus,
  X,
  Trash2,
  RotateCcw,
  Menu,
  CaseSensitive,
  FileSearch,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import {
  type EditorMode,
  type StoredSignature,
} from "./pdf-viewer.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PdfViewerLeftSidebarProps {
  // Mode control
  mode: EditorMode;
  onSetMode: (m: EditorMode) => void;

  // Shape sub-tool
  shapeType: "circle" | "rect" | "line";
  onSetShapeType: (t: "circle" | "rect" | "line") => void;

  // OCR tool
  pageOcrStatus: string;
  onHandlePageOcr: () => void;

  // Image upload
  onHandleImageUpload: () => void;

  // Signature modal state
  showSigModal: boolean;
  onSetShowSigModal: (v: boolean) => void;
  sigDrawing: boolean;
  onSetSigDrawing: (v: boolean) => void;
  sigName: string;
  onSetSigName: (v: string) => void;
  savedSignatures: StoredSignature[];
  renamingId: string | null;
  onSetRenamingId: (id: string | null) => void;
  renameValue: string;
  onSetRenameValue: (v: string) => void;
  sigCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onSigPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onSigPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onSigPointerUp: () => void;
  onClearSigCanvas: () => void;
  onSigUndo: () => void;
  onSigRedo: () => void;
  onSaveSignature: () => void;
  onPlaceSignature: (sig: StoredSignature) => void;
  onDeleteSignature: (id: string) => void;
  onCommitRename: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Shared tool list used by both the mobile Sheet and the desktop aside
// ---------------------------------------------------------------------------

function ToolList({
  mode,
  shapeType,
  pageOcrStatus,
  onSetMode,
  onSetShapeType,
  onHandlePageOcr,
  onHandleImageUpload,
  onSetShowSigModal,
  layout,
}: {
  mode: EditorMode;
  shapeType: "circle" | "rect" | "line";
  pageOcrStatus: string;
  onSetMode: (m: EditorMode) => void;
  onSetShapeType: (t: "circle" | "rect" | "line") => void;
  onHandlePageOcr: () => void;
  onHandleImageUpload: () => void;
  onSetShowSigModal: (v: boolean) => void;
  layout: "mobile" | "desktop";
}) {
  const isDesktop = layout === "desktop";

  if (!isDesktop) {
    // Mobile: text buttons in a Sheet
    return (
      <div className="flex flex-col gap-1">
        <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Tools
        </span>
        <Button
          variant={mode === "select" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => onSetMode("select")}
        >
          <MousePointer className="h-4 w-4" /> Select
        </Button>
        <Button
          variant={mode === "add-text" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => onSetMode("add-text")}
          title="Add text (T)"
        >
          <Type className="h-4 w-4" /> Text
        </Button>
        <Button
          variant={mode === "area-scan" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => onSetMode("area-scan")}
        >
          <ScanLine className="h-4 w-4" /> Scan
        </Button>
        <Button
          variant={mode === "area-ocr" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => onSetMode("area-ocr")}
        >
          <CaseSensitive className="h-4 w-4" /> OCR Area
        </Button>
        <Button
          variant={pageOcrStatus === "running" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
          disabled={pageOcrStatus === "running"}
          onClick={onHandlePageOcr}
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
          onClick={() => onSetMode(mode === "add-qr" ? "select" : "add-qr")}
          title="Add QR code (Q)"
        >
          <QrCode className="h-4 w-4" /> QR Code
        </Button>
        <Button
          variant={mode === "add-barcode" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() =>
            onSetMode(mode === "add-barcode" ? "select" : "add-barcode")
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
            onSetMode(mode === "add-shape" ? "select" : "add-shape")
          }
          title="Add shape (R/C/L)"
        >
          <Shapes className="h-4 w-4" /> Shape
        </Button>
        {mode === "add-shape" && (
          <div className="ml-6 flex gap-1">
            <Button
              variant={shapeType === "rect" ? "secondary" : "ghost"}
              size="icon"
              title="Rectangle (R)"
              onClick={() => onSetShapeType("rect")}
              className="h-7 w-7"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={shapeType === "circle" ? "secondary" : "ghost"}
              size="icon"
              title="Circle (C)"
              onClick={() => onSetShapeType("circle")}
              className="h-7 w-7"
            >
              <Circle className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={shapeType === "line" ? "secondary" : "ghost"}
              size="icon"
              title="Line / Arrow (L)"
              onClick={() => onSetShapeType("line")}
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
          onClick={() => onSetMode(mode === "draw" ? "select" : "draw")}
        >
          <Pencil className="h-4 w-4" /> Draw
        </Button>
        <Button
          variant={mode === "add-signature" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            onSetMode("add-signature");
            onSetShowSigModal(true);
          }}
        >
          <PenLine className="h-4 w-4" /> Signature
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onHandleImageUpload}
          title="Add image (I)"
        >
          <Image className="h-4 w-4" /> Image
        </Button>
      </div>
    );
  }

  // Desktop: icon-only strip with tooltips
  return (
    <>
      <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Tools
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === "select" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Select mode"
            onClick={() => onSetMode("select")}
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
            onClick={() => onSetMode("add-text")}
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
            onClick={() => onSetMode("area-scan")}
            className="h-9 w-9"
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Scan area for QR / barcode</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === "area-ocr" ? "secondary" : "ghost"}
            size="icon"
            aria-label="OCR text extraction"
            onClick={() => onSetMode("area-ocr")}
            className="h-9 w-9"
          >
            <CaseSensitive className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Extract text with OCR</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={pageOcrStatus === "running" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Full-page OCR"
            disabled={pageOcrStatus === "running"}
            onClick={onHandlePageOcr}
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
        <TooltipContent side="right">Extract all text from page</TooltipContent>
      </Tooltip>

      <div className="my-0.5 h-px w-full bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === "add-qr" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Generate QR code"
            onClick={() => onSetMode(mode === "add-qr" ? "select" : "add-qr")}
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
              onSetMode(mode === "add-barcode" ? "select" : "add-barcode")
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
              onSetMode(mode === "add-shape" ? "select" : "add-shape")
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

      {mode === "add-shape" && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={shapeType === "rect" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Rectangle"
                onClick={() => onSetShapeType("rect")}
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
                variant={shapeType === "circle" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Circle"
                onClick={() => onSetShapeType("circle")}
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
                onClick={() => onSetShapeType("line")}
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
            onClick={() => onSetMode(mode === "draw" ? "select" : "draw")}
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
              onSetMode("add-signature");
              onSetShowSigModal(true);
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
            onClick={onHandleImageUpload}
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PdfViewerLeftSidebar({
  mode,
  onSetMode,
  shapeType,
  onSetShapeType,
  pageOcrStatus,
  onHandlePageOcr,
  onHandleImageUpload,
  showSigModal,
  onSetShowSigModal,
  sigDrawing,
  onSetSigDrawing,
  sigName,
  onSetSigName,
  savedSignatures,
  renamingId,
  onSetRenamingId,
  renameValue,
  onSetRenameValue,
  sigCanvasRef,
  onSigPointerDown,
  onSigPointerMove,
  onSigPointerUp,
  onClearSigCanvas,
  onSigUndo,
  onSigRedo,
  onSaveSignature,
  onPlaceSignature,
  onDeleteSignature,
  onCommitRename,
}: PdfViewerLeftSidebarProps) {
  const toolListProps = {
    mode,
    shapeType,
    pageOcrStatus,
    onSetMode,
    onSetShapeType,
    onHandlePageOcr,
    onHandleImageUpload,
    onSetShowSigModal,
  };

  return (
    <>
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
            <ToolList {...toolListProps} layout="mobile" />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: permanent vertical icon strip */}
      <aside className="hidden w-14 flex-col items-center gap-1 rounded-lg border bg-card p-1.5 lg:flex">
        <ToolList {...toolListProps} layout="desktop" />
      </aside>

      {/* Signature modal — position:fixed, renders full-screen regardless of DOM parent */}
      {showSigModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onSetShowSigModal(false);
              onSetMode("select");
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
                  onSetShowSigModal(false);
                  onSetMode("select");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => onSetSigDrawing(false)}
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
                onClick={() => onSetSigDrawing(true)}
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
                      <Button size="sm" onClick={() => onSetSigDrawing(true)}>
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
                              onChange={(e) => onSetRenameValue(e.target.value)}
                              onBlur={() => onCommitRename(sig.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  onCommitRename(sig.id);
                                }
                                if (e.key === "Escape") onSetRenamingId(null);
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
                              onSetRenamingId(sig.id);
                              onSetRenameValue(sig.name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => onPlaceSignature(sig)}>
                            Use
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteSignature(sig.id)}
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
                    <label className="shrink-0 text-xs text-muted-foreground">
                      Name
                    </label>
                    <input
                      type="text"
                      value={sigName}
                      onChange={(e) => onSetSigName(e.target.value)}
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
                      onPointerDown={onSigPointerDown}
                      onPointerMove={onSigPointerMove}
                      onPointerUp={onSigPointerUp}
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Draw your signature above
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={onClearSigCanvas}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Clear
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={onSaveSignature}
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
    </>
  );
}
