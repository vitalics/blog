"use client";

import React from "react";
import {
  Trash2,
  Minus,
  Circle,
  Square,
  PencilLine,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  type Annotation,
  type TextAnnotation,
  type ImageAnnotation,
  type ShapeAnnotation,
  type DrawAnnotation,
  type EditorMode,
  isSignature,
  isImage,
  isShape,
  isDraw,
  isText,
  FontSelect,
  OcrLangSelect,
} from "./pdf-viewer.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PdfViewerRightSidebarProps {
  mode: EditorMode;
  shapeType: "circle" | "rect" | "line";
  selectedId: string | null;
  selectedAnn: Annotation | undefined;
  selectedIsShape: boolean;
  selectedIsDraw: boolean;
  panelText: string;
  newFontSize: number;
  newColor: string;
  newBgColor: string;
  newStrokeColor: string;
  newFillColor: string;
  newStrokeWidth: number;
  arrowStart: boolean;
  arrowEnd: boolean;
  ocrLang: string;
  annotations: Annotation[];
  currentPage: number;
  onSetOcrLang: (v: string) => void;
  onSetPanelText: (v: string) => void;
  onSetNewFontSize: (v: number) => void;
  onSetNewColor: (v: string) => void;
  onSetNewBgColor: (v: string) => void;
  onSetNewStrokeColor: (v: string) => void;
  onSetNewFillColor: (v: string) => void;
  onSetNewStrokeWidth: (v: number) => void;
  onSetArrowStart: (v: boolean) => void;
  onSetArrowEnd: (v: boolean) => void;
  onUpdateSelected: (patch: Partial<TextAnnotation>) => void;
  onCommitSelectedUpdate: (patch: Partial<TextAnnotation>) => void;
  onUpdateSelectedShape: (patch: Partial<ShapeAnnotation & DrawAnnotation>) => void;
  onCommitSelectedShapeUpdate: (patch: Partial<ShapeAnnotation & DrawAnnotation>) => void;
  onSetSelectedId: (id: string | null) => void;
  onSetCurrentPage: (page: number) => void;
  onDeleteSelected: () => void;
  onHandleImageReplace: (id: string) => void;
  onSetAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onCommitAnnotationPatch: (patch: Partial<Annotation>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfViewerRightSidebar({
  mode,
  shapeType,
  selectedId,
  selectedAnn,
  selectedIsShape,
  selectedIsDraw,
  panelText,
  newFontSize,
  newColor,
  newBgColor,
  newStrokeColor,
  newFillColor,
  newStrokeWidth,
  arrowStart,
  arrowEnd,
  ocrLang,
  annotations,
  onSetOcrLang,
  onSetPanelText,
  onSetNewFontSize,
  onSetNewColor,
  onSetNewBgColor,
  onSetNewStrokeColor,
  onSetNewFillColor,
  onSetNewStrokeWidth,
  onSetArrowStart,
  onSetArrowEnd,
  onUpdateSelected,
  onCommitSelectedUpdate,
  onUpdateSelectedShape,
  onCommitSelectedShapeUpdate,
  onSetSelectedId,
  onSetCurrentPage,
  onDeleteSelected,
  onHandleImageReplace,
  onSetAnnotations,
  onCommitAnnotationPatch,
}: PdfViewerRightSidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="rounded-lg border bg-card">
        {/* OCR language — shown when any OCR mode is active */}
        {(mode === "area-ocr" || mode === "area-scan") && (
          <div className="border-b p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              OCR language
            </p>
            <OcrLangSelect value={ocrLang} onChange={onSetOcrLang} />
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

          {/* Draw properties */}
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
                      onSetPanelText(e.target.value);
                      onUpdateSelected({ text: e.target.value });
                    }}
                    onBlur={(e) =>
                      onCommitSelectedUpdate({ text: e.target.value })
                    }
                    placeholder="Enter text..."
                    className="w-28 rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-xs text-muted-foreground">Font</label>
                  <div className="w-28">
                    <FontSelect
                      value={(selectedAnn as TextAnnotation)?.fontFamily ?? "helvetica"}
                      onChange={(fontFamily) => {
                        onUpdateSelected({ fontFamily });
                        onCommitSelectedUpdate({ fontFamily });
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

          {/* QR/Barcode properties */}
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
                    onSetAnnotations((prev) =>
                      prev.map((a) =>
                        a.id === selectedAnn.id
                          ? ({ ...a, label } as ImageAnnotation)
                          : a,
                      ),
                    );
                  }}
                  onBlur={() => {
                    const regenerateImage = async () => {
                      if (!selectedAnn || !("label" in selectedAnn)) return;
                      const text =
                        selectedAnn.label
                          ?.replace("QR: ", "")
                          .replace("Barcode: ", "") || "";

                      if (selectedAnn.label?.includes("QR")) {
                        const QRCode = (await import("qrcode")).default;
                        const offscreen = document.createElement("canvas");
                        await QRCode.toCanvas(offscreen, text, {
                          width: 200,
                          errorCorrectionLevel: "M",
                        });
                        const dataUrl = offscreen.toDataURL("image/png");
                        onSetAnnotations((prev) =>
                          prev.map((a) =>
                            a.id === selectedAnn.id
                              ? ({ ...a, dataUrl } as ImageAnnotation)
                              : a,
                          ),
                        );
                      } else {
                        const JsBarcode = (await import("jsbarcode")).default;
                        const offscreen = document.createElement("canvas");
                        JsBarcode(offscreen, text, {
                          format: "CODE128",
                          width: 2,
                          height: 80,
                          displayValue: true,
                          fontSize: 14,
                        });
                        const dataUrl = offscreen.toDataURL("image/png");
                        onSetAnnotations((prev) =>
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

          {/* Image source */}
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
                    onClick={() => onHandleImageReplace(selectedAnn.id)}
                    className="shrink-0 text-xs"
                  >
                    Replace
                  </Button>
                </div>
              </div>
            )}
        </div>

        {/* Position */}
        {selectedAnn && (
          <div className="border-b p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Position
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs items-center">
              {isDraw(selectedAnn) ? (
                (() => {
                  const xs = selectedAnn.points.map((p) => p.x);
                  const ys = selectedAnn.points.map((p) => p.y);
                  const minX = Math.min(...xs);
                  const minY = Math.min(...ys);
                  const maxX = Math.max(...xs);
                  const maxY = Math.max(...ys);
                  // For draw, X/Y are read-only bounding box info
                  return (
                    <>
                      <span className="text-muted-foreground">X</span>
                      <span className="tabular-nums text-right">{(minX * 100).toFixed(1)}%</span>
                      <span className="text-muted-foreground">Y</span>
                      <span className="tabular-nums text-right">{(minY * 100).toFixed(1)}%</span>
                      <span className="text-muted-foreground">W</span>
                      <span className="tabular-nums text-right">{((maxX - minX) * 100).toFixed(1)}%</span>
                      <span className="text-muted-foreground">H</span>
                      <span className="tabular-nums text-right">{((maxY - minY) * 100).toFixed(1)}%</span>
                    </>
                  );
                })()
              ) : isShape(selectedAnn) && selectedAnn.shape === "line" ? (
                <>
                  {(["x1", "y1", "x2", "y2"] as const).map((field) => {
                    const isEnd = field === "x2" || field === "y2";
                    const ratioKey = field === "x1" ? "xRatio" : field === "y1" ? "yRatio" : field === "x2" ? "x2Ratio" : "y2Ratio";
                    const currentRatio = isEnd
                      ? ((selectedAnn as ShapeAnnotation)[ratioKey as "x2Ratio" | "y2Ratio"] ?? (field === "x2" ? selectedAnn.xRatio : selectedAnn.yRatio))
                      : (selectedAnn as ShapeAnnotation)[ratioKey as "xRatio" | "yRatio"];
                    return (
                      <React.Fragment key={field}>
                        <label className="text-muted-foreground">{field.toUpperCase()}</label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={parseFloat((currentRatio * 100).toFixed(1))}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100;
                              onSetAnnotations((prev) =>
                                prev.map((a) => a.id === selectedAnn.id ? { ...a, [ratioKey]: v } as Annotation : a)
                              );
                            }}
                            onBlur={(e) => {
                              const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100;
                              onCommitAnnotationPatch({ [ratioKey]: v });
                            }}
                            className="w-full rounded border bg-background py-0.5 pl-1.5 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                          />
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </>
              ) : (
                <>
                  {(["xRatio", "yRatio"] as const).map((ratioKey) => (
                    <React.Fragment key={ratioKey}>
                      <label className="text-muted-foreground">{ratioKey === "xRatio" ? "X" : "Y"}</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={parseFloat(((selectedAnn as { xRatio: number; yRatio: number })[ratioKey] * 100).toFixed(1))}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100;
                            onSetAnnotations((prev) =>
                              prev.map((a) => a.id === selectedAnn.id ? { ...a, [ratioKey]: v } as Annotation : a)
                            );
                          }}
                          onBlur={(e) => {
                            const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100;
                            onCommitAnnotationPatch({ [ratioKey]: v });
                          }}
                          className="w-full rounded border bg-background py-0.5 pl-1.5 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                        />
                        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                      </div>
                    </React.Fragment>
                  ))}
                  {"wRatio" in selectedAnn && (
                    <>
                      <span className="text-muted-foreground">W</span>
                      <span className="tabular-nums text-right">{(selectedAnn.wRatio * 100).toFixed(1)}%</span>
                      <span className="text-muted-foreground">H</span>
                      <span className="tabular-nums text-right">{(selectedAnn.hRatio * 100).toFixed(1)}%</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

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
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
