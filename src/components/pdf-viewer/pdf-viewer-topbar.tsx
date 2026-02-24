"use client";

import React from "react";
import {
  FileText,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  Trash2,
  Plus,
  Minus,
  Save,
  Undo2,
  Redo2,
  SlidersHorizontal,
  PencilLine,
  PenLine,
  Circle,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  type Annotation,
  type TextAnnotation,
  type ShapeAnnotation,
  type DrawAnnotation,
  type EditorMode,
  isSignature,
  isImage,
  isShape,
  isDraw,
  OcrLangSelect,
  isMac,
  formatBytes,
  SCALE_MIN,
  SCALE_MAX,
} from "./pdf-viewer.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PdfViewerTopBarProps {
  // File info
  pdfFile: File;
  onClose: () => void;

  // Page navigation
  currentPage: number;
  totalPages: number;
  onGoToPrev: () => void;
  onGoToNext: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;

  // Zoom
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;

  // Undo/redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Save/export/share
  sessionSaved: boolean;
  isExporting: boolean;
  canShare: boolean;
  isSharing: boolean;
  shareReady: boolean;
  onSave: () => void;
  onExport: () => void;
  onShare: () => void;

  // Mobile Sheet — mirrors RightSidebar props
  mode: EditorMode;
  shapeType: "circle" | "rect" | "line";
  selectedIsShape: boolean;
  selectedIsDraw: boolean;
  selectedAnn: Annotation | undefined;
  annotations: Annotation[];
  selectedId: string | null;
  panelText: string;
  newStrokeColor: string;
  newFillColor: string;
  newStrokeWidth: number;
  newFontSize: number;
  newColor: string;
  newBgColor: string;
  arrowStart: boolean;
  arrowEnd: boolean;
  ocrLang: string;
  onSetOcrLang: (v: string) => void;
  onSetPanelText: (v: string) => void;
  onSetNewStrokeColor: (v: string) => void;
  onSetNewFillColor: (v: string) => void;
  onSetNewStrokeWidth: (v: number) => void;
  onSetNewFontSize: (v: number) => void;
  onSetNewColor: (v: string) => void;
  onSetNewBgColor: (v: string) => void;
  onSetArrowStart: (v: boolean) => void;
  onSetArrowEnd: (v: boolean) => void;
  onUpdateSelected: (patch: Partial<TextAnnotation>) => void;
  onCommitSelectedUpdate: (patch: Partial<TextAnnotation>) => void;
  onUpdateSelectedShape: (patch: Partial<ShapeAnnotation & DrawAnnotation>) => void;
  onCommitSelectedShapeUpdate: (patch: Partial<ShapeAnnotation & DrawAnnotation>) => void;
  onSetSelectedId: (id: string | null) => void;
  onSetCurrentPage: (page: number) => void;
  onDeleteSelected: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfViewerTopBar({
  pdfFile,
  onClose,
  currentPage,
  totalPages,
  onGoToPrev,
  onGoToNext,
  onAddPage,
  onDeletePage,
  scale,
  onZoomIn,
  onZoomOut,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  sessionSaved,
  isExporting,
  canShare,
  isSharing,
  shareReady,
  onSave,
  onExport,
  onShare,
  mode,
  shapeType,
  selectedIsShape,
  selectedIsDraw,
  selectedAnn,
  annotations,
  selectedId,
  panelText,
  newStrokeColor,
  newFillColor,
  newStrokeWidth,
  newFontSize,
  newColor,
  newBgColor,
  arrowStart,
  arrowEnd,
  ocrLang,
  onSetOcrLang,
  onSetPanelText,
  onSetNewStrokeColor,
  onSetNewFillColor,
  onSetNewStrokeWidth,
  onSetNewFontSize,
  onSetNewColor,
  onSetNewBgColor,
  onSetArrowStart,
  onSetArrowEnd,
  onUpdateSelected,
  onCommitSelectedUpdate,
  onUpdateSelectedShape,
  onCommitSelectedShapeUpdate,
  onSetSelectedId,
  onSetCurrentPage,
  onDeleteSelected,
}: PdfViewerTopBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      {/* File info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FileText
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate text-sm font-medium">{pdfFile.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatBytes(pdfFile.size)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          aria-label="Close PDF"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onGoToPrev}
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
          onClick={onGoToNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onAddPage}
          aria-label="Add page after current"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onDeletePage}
          aria-label="Delete current page"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onZoomOut}
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
              onClick={onZoomIn}
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

      {/* Undo/redo */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onUndo}
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
              onClick={onRedo}
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

      {/* Save/export/share */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onSave}
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
            onClick={onShare}
            disabled={isSharing || !shareReady}
            aria-label="Share PDF"
            title={shareReady ? "Share PDF" : "Preparing…"}
          >
            <Share2
              className={[
                "h-4 w-4",
                isSharing ? "animate-pulse" : !shareReady ? "opacity-40" : "",
              ].join(" ")}
            />
          </Button>
        )}
        <Button
          size="sm"
          className="gap-1.5"
          onClick={onExport}
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
              <OcrLangSelect value={ocrLang} onChange={onSetOcrLang} />
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
                  <label className="text-xs text-muted-foreground">Stroke</label>
                  <ColorPicker
                    value={newStrokeColor}
                    onChange={onSetNewStrokeColor}
                    onBlur={(hex) =>
                      onCommitSelectedShapeUpdate({ strokeColor: hex })
                    }
                  />
                </div>
                {shapeType !== "line" &&
                  !(
                    selectedIsShape &&
                    (selectedAnn as ShapeAnnotation)?.shape === "line"
                  ) && (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="text-xs text-muted-foreground">Fill</label>
                      <div className="flex items-center gap-1">
                        <ColorPicker
                          value={newFillColor === "none" ? "#ffffff" : newFillColor}
                          disabled={newFillColor === "none"}
                          onChange={onSetNewFillColor}
                          onBlur={(hex) =>
                            onCommitSelectedShapeUpdate({ fillColor: hex })
                          }
                        />
                        <button
                          type="button"
                          title={newFillColor === "none" ? "Enable fill" : "Remove fill"}
                          onClick={() => {
                            const next = newFillColor === "none" ? "#ffffff" : "none";
                            onSetNewFillColor(next);
                            onCommitSelectedShapeUpdate({ fillColor: next });
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
                      (selectedAnn as ShapeAnnotation)?.shape === "line")
                      ? "mb-2"
                      : "",
                  ].join(" ")}
                >
                  <label className="text-xs text-muted-foreground">Width</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newStrokeWidth}
                    onChange={(e) => onSetNewStrokeWidth(Number(e.target.value))}
                    onBlur={(e) =>
                      onCommitSelectedShapeUpdate({
                        strokeWidth: Number(e.target.value),
                      })
                    }
                    className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {(shapeType === "line" ||
                  (selectedIsShape &&
                    (selectedAnn as ShapeAnnotation)?.shape === "line")) && (
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-muted-foreground">Arrows</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Arrow at start"
                        onClick={() => {
                          const v = !arrowStart;
                          onSetArrowStart(v);
                          onCommitSelectedShapeUpdate({ arrowStart: v });
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
                          onSetArrowEnd(v);
                          onCommitSelectedShapeUpdate({ arrowEnd: v });
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
                    <label className="text-xs text-muted-foreground">Color</label>
                    <ColorPicker
                      value={newStrokeColor}
                      onChange={onSetNewStrokeColor}
                      onBlur={(hex) =>
                        onCommitSelectedShapeUpdate({ strokeColor: hex })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-muted-foreground">Width</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newStrokeWidth}
                      onChange={(e) => onSetNewStrokeWidth(Number(e.target.value))}
                      onBlur={(e) =>
                        onCommitSelectedShapeUpdate({
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
                    <label className="text-xs text-muted-foreground">Size</label>
                    <input
                      type="number"
                      min={6}
                      max={96}
                      value={newFontSize}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onSetNewFontSize(v);
                        onUpdateSelected({ fontSize: v });
                      }}
                      onBlur={(e) =>
                        onCommitSelectedUpdate({
                          fontSize: Number(e.target.value),
                        })
                      }
                      className="w-16 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="text-xs text-muted-foreground">Color</label>
                    <ColorPicker
                      value={newColor}
                      onChange={(hex) => {
                        onSetNewColor(hex);
                        onUpdateSelected({ color: hex });
                      }}
                      onBlur={(hex) => onCommitSelectedUpdate({ color: hex })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-muted-foreground">
                      Background
                    </label>
                    <div className="flex items-center gap-1">
                      <ColorPicker
                        value={newBgColor === "none" ? "#ffffff" : newBgColor}
                        disabled={newBgColor === "none"}
                        onChange={(hex) => {
                          onSetNewBgColor(hex);
                          onUpdateSelected({ bgColor: hex });
                        }}
                        onBlur={(hex) => onCommitSelectedUpdate({ bgColor: hex })}
                      />
                      <button
                        type="button"
                        title={
                          newBgColor === "none"
                            ? "Enable background"
                            : "Remove background"
                        }
                        onClick={() => {
                          const next = newBgColor === "none" ? "#ffffff" : "none";
                          onSetNewBgColor(next);
                          onUpdateSelected({ bgColor: next });
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
              <p className="text-xs text-muted-foreground">No annotations yet.</p>
            ) : (
              <ul className="space-y-1">
                {annotations.map((ann) => (
                  <li key={ann.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSetSelectedId(ann.id);
                        onSetCurrentPage(ann.page);
                      }}
                      className={[
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                        ann.id === selectedId ? "bg-muted font-medium" : "",
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
                onClick={onDeleteSelected}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
