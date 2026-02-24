"use client";

import React from "react";
import { Check, Copy, QrCode, Barcode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  type Annotation,
  type EditorMode,
  type SelectRect,
  type TextAnnotation,
  isShape,
  isDraw,
  isSignature,
  isImage,
  contrastColor,
} from "./pdf-viewer.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PdfViewerEditorProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  currentPage: number;
  canvasDimensions: { width: number; height: number };
  mode: EditorMode;
  shapeType: "circle" | "rect" | "line";
  scanStatus: string;
  pageOcrStatus: string;
  pageOcrText: string;
  ocrCopied: boolean;
  onSetPageOcrStatus: (v: "idle" | "running" | "done" | "error") => void;
  onSetPageOcrText: (v: string) => void;
  onHandleOcrCopy: () => void;
  showGenPanel: boolean;
  genText: string;
  genBarcodeFormat: string;
  onSetGenText: (v: string) => void;
  onSetGenBarcodeFormat: (v: string) => void;
  onPlaceQrCode: () => void;
  onPlaceBarcodeImage: () => void;
  /** All annotations for the current page (already filtered) */
  annotations: Annotation[];
  selectedId: string | null;
  editingId: string | null;
  onSetAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onSetSelectedId: (id: string | null) => void;
  onSetEditingId: (id: string | null) => void;
  shapeRect: SelectRect | null;
  selectRect: SelectRect | null;
  newStrokeColor: string;
  newStrokeWidth: number;
  newFillColor: string;
  arrowStart: boolean;
  arrowEnd: boolean;
  livePoints: { x: number; y: number }[];
  overlayCursor: string;
  onOverlayPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onOverlayPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onOverlayPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onAnnotationPointerDown: (e: React.PointerEvent, id: string) => void;
  onAnnotationPointerMove: (e: React.PointerEvent) => void;
  onAnnotationPointerUp: () => void;
  onResizePointerDown: (e: React.PointerEvent, id: string) => void;
  onResizePointerMove: (e: React.PointerEvent) => void;
  onResizePointerUp: () => void;
  onLineEndpointDown: (
    e: React.PointerEvent<SVGCircleElement>,
    id: string,
    end: "start" | "end",
  ) => void;
  panelText: string;
  onSetPanelText: (v: string) => void;
  scale: number;
  // Refs needed for text tap-to-edit logic
  lastTapTimeRef: React.MutableRefObject<number>;
  annotationsRef: React.MutableRefObject<Annotation[]>;
  preEditSnapshotRef: React.MutableRefObject<Annotation[] | null>;
  onPushHistory: (next: Annotation[], prev?: Annotation[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfViewerEditor({
  canvasRef,
  overlayRef,
  currentPage,
  canvasDimensions,
  mode,
  shapeType,
  scanStatus,
  pageOcrStatus,
  pageOcrText,
  ocrCopied,
  onSetPageOcrStatus,
  onSetPageOcrText,
  onHandleOcrCopy,
  showGenPanel,
  genText,
  genBarcodeFormat,
  onSetGenText,
  onSetGenBarcodeFormat,
  onPlaceQrCode,
  onPlaceBarcodeImage,
  annotations,
  selectedId,
  editingId,
  onSetAnnotations,
  onSetSelectedId,
  onSetEditingId,
  shapeRect,
  selectRect,
  newStrokeColor,
  newStrokeWidth,
  newFillColor,
  arrowStart,
  arrowEnd,
  livePoints,
  overlayCursor,
  onOverlayPointerDown,
  onOverlayPointerMove,
  onOverlayPointerUp,
  onAnnotationPointerDown,
  onAnnotationPointerMove,
  onAnnotationPointerUp,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onLineEndpointDown,
  panelText,
  onSetPanelText,
  scale,
  lastTapTimeRef,
  annotationsRef,
  preEditSnapshotRef,
  onPushHistory,
}: PdfViewerEditorProps) {
  return (
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
          Draw freehand — configure stroke color and width in the panel
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
                  onClick={onHandleOcrCopy}
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
                  onSetPageOcrStatus("idle");
                  onSetPageOcrText("");
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
            {mode === "add-qr" ? "Generate QR code" : "Generate barcode"}
          </p>
          {mode === "add-barcode" && (
            <select
              value={genBarcodeFormat}
              onChange={(e) => onSetGenBarcodeFormat(e.target.value)}
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
              mode === "add-qr" ? "https://example.com" : "Enter barcode value"
            }
            value={genText}
            onChange={(e) => onSetGenText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                mode === "add-qr" ? onPlaceQrCode() : onPlaceBarcodeImage();
              }
            }}
            className="w-full rounded border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={mode === "add-qr" ? onPlaceQrCode : onPlaceBarcodeImage}
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
        <div className="relative mx-auto" style={{ width: "fit-content" }}>
          <canvas
            ref={canvasRef}
            aria-label={`PDF page ${currentPage} of ${canvasDimensions.width > 0 ? "?" : "?"}`}
            className="block"
          />

          {/* Overlay */}
          <div
            ref={overlayRef}
            className={["absolute inset-0 select-none", overlayCursor].join(
              " ",
            )}
            style={{ touchAction: "none" }}
            onPointerDown={onOverlayPointerDown}
            onPointerMove={onOverlayPointerMove}
            onPointerUp={onOverlayPointerUp}
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
            {shapeRect && mode === "add-shape" && shapeType !== "line" && (
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/10"
                style={{
                  left: Math.min(shapeRect.x1, shapeRect.x2),
                  top: Math.min(shapeRect.y1, shapeRect.y2),
                  width: Math.abs(shapeRect.x2 - shapeRect.x1),
                  height: Math.abs(shapeRect.y2 - shapeRect.y1),
                  borderRadius: shapeType === "circle" ? "50%" : undefined,
                  borderColor: newStrokeColor,
                  backgroundColor:
                    newFillColor !== "none" ? `${newFillColor}33` : undefined,
                }}
              />
            )}
            {shapeRect && mode === "add-shape" && shapeType === "line" && (
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
                    <path d="M0,0 L8,4 L0,8 Z" fill={newStrokeColor} />
                  </marker>
                  <marker
                    id="preview-arrow-start"
                    markerWidth="8"
                    markerHeight="8"
                    refX="2"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M8,0 L0,4 L8,8 Z" fill={newStrokeColor} />
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
                  markerEnd={arrowEnd ? "url(#preview-arrow-end)" : undefined}
                  markerStart={
                    arrowStart ? "url(#preview-arrow-start)" : undefined
                  }
                />
              </svg>
            )}

            {/* Freehand draw live preview */}
            {mode === "draw" &&
              livePoints.length >= 2 &&
              (() => {
                const cw =
                  canvasDimensions.width || canvasRef.current?.width || 1;
                const ch =
                  canvasDimensions.height || canvasRef.current?.height || 1;
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
            {annotations.map((ann) => {
              const w =
                canvasDimensions.width || canvasRef.current?.width || 0;
              const h =
                canvasDimensions.height || canvasRef.current?.height || 0;
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
                      data-ann-id={ann.id}
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
                        style={{ pointerEvents: "stroke", cursor: "move" }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onAnnotationPointerDown(
                            e as React.PointerEvent,
                            ann.id,
                          );
                        }}
                        onPointerMove={(e) => {
                          onAnnotationPointerMove(e as React.PointerEvent);
                          onResizePointerMove(e as React.PointerEvent);
                        }}
                        onPointerUp={() => {
                          onAnnotationPointerUp();
                          onResizePointerUp();
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
                          ann.arrowStart ? `url(#${mid}-rev)` : undefined
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
                              onLineEndpointDown(e, ann.id, "start")
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
                              onLineEndpointDown(e, ann.id, "end")
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
                        ann.fillColor === "none" ? undefined : ann.fillColor,
                      borderRadius:
                        ann.shape === "circle" ? "50%" : undefined,
                      cursor: "move",
                      boxSizing: "border-box",
                    }}
                    data-ann-id={ann.id}
                    className={
                      isSelected
                        ? "outline outline-2 outline-offset-2 outline-primary"
                        : ""
                    }
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onAnnotationPointerDown(e, ann.id);
                    }}
                    onPointerMove={(e) => {
                      onAnnotationPointerMove(e);
                      onResizePointerMove(e);
                    }}
                    onPointerUp={() => {
                      onAnnotationPointerUp();
                      onResizePointerUp();
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
                              opacity: 0,
                            }}
                            className="rounded-sm border-2"
                            onPointerDown={(e) =>
                              onResizePointerDown(e, ann.id)
                            }
                            onPointerMove={onResizePointerMove}
                            onPointerUp={onResizePointerUp}
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
                    data-ann-id={ann.id}
                    className={
                      isSelected
                        ? "outline outline-2 outline-offset-2 outline-primary rounded"
                        : ""
                    }
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onAnnotationPointerDown(e, ann.id);
                    }}
                    onPointerMove={onAnnotationPointerMove}
                    onPointerUp={onAnnotationPointerUp}
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
                    data-ann-id={ann.id}
                    className={
                      isSelected
                        ? "outline outline-2 outline-offset-2 outline-primary"
                        : ""
                    }
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onAnnotationPointerDown(e, ann.id);
                    }}
                    onPointerMove={(e) => {
                      onAnnotationPointerMove(e);
                      onResizePointerMove(e);
                    }}
                    onPointerUp={() => {
                      onAnnotationPointerUp();
                      onResizePointerUp();
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
                          opacity: 0,
                        }}
                        className="rounded-sm border-2"
                        onPointerDown={(e) => onResizePointerDown(e, ann.id)}
                        onPointerMove={onResizePointerMove}
                        onPointerUp={onResizePointerUp}
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
                    data-ann-id={ann.id}
                    className={
                      isSelected
                        ? "outline outline-2 outline-offset-2 outline-primary"
                        : ""
                    }
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onAnnotationPointerDown(e, ann.id);
                    }}
                    onPointerMove={(e) => {
                      onAnnotationPointerMove(e);
                      onResizePointerMove(e);
                    }}
                    onPointerUp={() => {
                      onAnnotationPointerUp();
                      onResizePointerUp();
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
                          opacity: 0,
                        }}
                        className="rounded-sm border-2"
                        onPointerDown={(e) => onResizePointerDown(e, ann.id)}
                        onPointerMove={onResizePointerMove}
                        onPointerUp={onResizePointerUp}
                      />
                    )}
                  </div>
                );
              }

              // Text annotation
              const textAnn = ann as TextAnnotation;
              const left = textAnn.xRatio * w;
              const top = textAnn.yRatio * h;
              return (
                <div
                  key={textAnn.id}
                  style={{
                    left,
                    top,
                    position: "absolute",
                    fontSize: textAnn.fontSize * scale,
                    fontFamily:
                      textAnn.fontFamily ?? "Helvetica, Arial, sans-serif",
                    color: textAnn.color,
                    lineHeight: 1,
                    backgroundColor:
                      textAnn.bgColor === "none" ? undefined : textAnn.bgColor,
                    touchAction: "none",
                  }}
                  data-ann-id={textAnn.id}
                  className={[
                    "select-none",
                    isSelected
                      ? "outline outline-2 outline-offset-2 outline-primary"
                      : "",
                    !isEditing ? "cursor-move" : "",
                  ].join(" ")}
                  onPointerDown={(e) =>
                    onAnnotationPointerDown(e, textAnn.id)
                  }
                  onPointerMove={onAnnotationPointerMove}
                  onPointerUp={onAnnotationPointerUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    const now = Date.now();
                    const DOUBLE_TAP_DELAY = 300;
                    if (
                      lastTapTimeRef.current &&
                      now - lastTapTimeRef.current < DOUBLE_TAP_DELAY
                    ) {
                      preEditSnapshotRef.current = annotationsRef.current;
                      onSetEditingId(textAnn.id);
                      onSetSelectedId(textAnn.id);
                    } else {
                      lastTapTimeRef.current = now;
                      onSetSelectedId(textAnn.id);
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    const now = Date.now();
                    const DOUBLE_TAP_DELAY = 300;
                    if (
                      lastTapTimeRef.current &&
                      now - lastTapTimeRef.current < DOUBLE_TAP_DELAY
                    ) {
                      preEditSnapshotRef.current = annotationsRef.current;
                      onSetEditingId(textAnn.id);
                      onSetSelectedId(textAnn.id);
                    } else {
                      lastTapTimeRef.current = now;
                      onSetSelectedId(textAnn.id);
                    }
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
                          }, 100);
                        }
                      }}
                      onFocus={(e) => {
                        e.target.select();
                      }}
                      value={textAnn.text}
                      onChange={(e) => {
                        onSetAnnotations((prev) =>
                          prev.map((a) =>
                            a.id === textAnn.id
                              ? ({ ...a, text: e.target.value } as TextAnnotation)
                              : a,
                          ),
                        );
                        onSetPanelText(e.target.value);
                      }}
                      onBlur={() => {
                        if (preEditSnapshotRef.current) {
                          onPushHistory(
                            annotationsRef.current,
                            preEditSnapshotRef.current,
                          );
                          preEditSnapshotRef.current = null;
                        }
                        onSetEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape")
                          (e.target as HTMLInputElement).blur();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                      }}
                      style={{
                        fontSize: "inherit",
                        color: "inherit",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        width: Math.max(
                          60,
                          textAnn.text.length * 0.65 * textAnn.fontSize * scale,
                        ),
                        touchAction: "manipulation",
                      }}
                    />
                  ) : (
                    <span>{textAnn.text}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
