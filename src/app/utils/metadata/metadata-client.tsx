"use client";

import { ArrowLeft, Check, Copy, FileSearch, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetadataRow {
  label: string;
  value: string;
}

type Status = "idle" | "reading" | "done" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s.toFixed(3)}s`);
  return parts.join(" ");
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function imageDimensions(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(`${img.naturalWidth} × ${img.naturalHeight} px`);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function mediaDuration(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(
      file.type.startsWith("video/") ? "video" : "audio",
    );
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(
        Number.isFinite(el.duration) ? formatDuration(el.duration) : null,
      );
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MetadataClient() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<MetadataRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(async (file: File) => {
    setStatus("reading");
    setErrorMsg(null);
    setFileName(file.name);
    try {
      const result: MetadataRow[] = [
        { label: "Name", value: file.name },
        {
          label: "Size",
          value: `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)`,
        },
        { label: "MIME type", value: file.type || "unknown" },
        {
          label: "Extension",
          value: file.name.includes(".")
            ? `.${file.name.split(".").pop()}`
            : "none",
        },
        {
          label: "Last modified",
          value: new Date(file.lastModified).toLocaleString(),
        },
      ];

      if (file.type.startsWith("image/")) {
        const dims = await imageDimensions(file);
        if (dims) result.push({ label: "Dimensions", value: dims });
      }

      if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
        const duration = await mediaDuration(file);
        if (duration) result.push({ label: "Duration", value: duration });
      }

      result.push({ label: "SHA-256", value: await sha256Hex(file) });

      setRows(result);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to read file.");
      setStatus("error");
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClear = () => {
    setRows([]);
    setFileName("");
    setStatus("idle");
    setErrorMsg(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const showDropZone = status === "idle" || status === "error";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FileSearch
            className="h-7 w-7 text-muted-foreground"
            aria-hidden="true"
          />
          <h1 className="text-4xl font-bold">File Metadata</h1>
        </div>
        <p className="text-muted-foreground">
          Inspect metadata of any file — size, type, dimensions, duration, and
          SHA-256 hash. Everything is read locally in your browser.
        </p>
      </div>

      <div className="space-y-4">
        {/* ── Drop zone ──────────────────────────────────────────────── */}
        {showDropZone && (
          // biome-ignore lint/a11y/useSemanticElements: drop zone needs div for drag-and-drop handlers
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop a file here or click to select"
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
              "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
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
              <p className="font-medium">Drop any file here</p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
            {status === "error" && errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </div>
        )}

        {/* ── Reading spinner ────────────────────────────────────────── */}
        {status === "reading" && (
          <div className="flex min-h-48 items-center justify-center rounded-xl border">
            <p className="animate-pulse text-muted-foreground">Reading file…</p>
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────── */}
        {status === "done" && rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium">{fileName}</p>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            </div>
            <div className="divide-y rounded-lg border bg-card">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {row.label}
                  </span>
                  <div className="flex min-w-0 items-start gap-1.5">
                    <span className="break-all text-right font-mono text-sm">
                      {row.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0"
                      aria-label={`Copy ${row.label}`}
                      onClick={() => handleCopy(row.value)}
                    >
                      {copied === row.value ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={handleClear}>
              Inspect another file
            </Button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
