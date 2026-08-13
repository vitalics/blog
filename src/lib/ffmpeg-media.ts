import type { FFmpeg } from "@ffmpeg/ffmpeg";

export interface MediaMetadata {
  tags: { label: string; value: string }[];
  streams: string[];
  coverUrl: string | null;
}

// Single-threaded core: no COOP/COEP headers required.
const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      // toBlobURL fetches through the browser HTTP cache, so the ~30 MB core
      // is downloaded once and served from cache on subsequent visits.
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })();
    // allow retry on the next attempt if the first load failed
    ffmpegPromise.catch(() => {
      ffmpegPromise = null;
    });
  }
  return ffmpegPromise;
}

function parseFfmpegLog(
  logs: string[],
): Pick<MediaMetadata, "tags" | "streams"> {
  const tags: { label: string; value: string }[] = [];
  const streams: string[] = [];
  let inMetadata = false;
  // only the first (container-level) Metadata block is captured — per-stream
  // blocks would duplicate keys like "title" and "comment"
  let metadataDone = false;

  for (const line of logs) {
    if (/^\s*Metadata:\s*$/.test(line)) {
      if (!metadataDone) inMetadata = true;
      continue;
    }
    if (inMetadata) {
      // metadata entries are indented deeper than section headers
      const match = line.match(/^\s{4,}([^:]+?)\s*:\s(.*)$/);
      if (match) {
        tags.push({ label: match[1].trim(), value: match[2].trim() });
        continue;
      }
      inMetadata = false;
      metadataDone = true;
    }
    const duration = line.match(
      /^\s*Duration:\s*([\d:.]+).*?bitrate:\s*(.+?)\s*$/,
    );
    if (duration) {
      tags.push({ label: "Duration (raw)", value: duration[1] });
      tags.push({ label: "Bitrate", value: duration[2] });
      continue;
    }
    const stream = line.match(/^\s*Stream\s+#.+$/);
    if (stream) {
      streams.push(stream[0].trim());
    }
  }
  return { tags, streams };
}

export async function extractMediaMetadata(
  file: File,
  onCoreLoaded?: () => void,
): Promise<MediaMetadata> {
  const ffmpeg = await getFFmpeg();
  onCoreLoaded?.();

  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => {
    logs.push(message);
  };
  ffmpeg.on("log", onLog);

  try {
    await ffmpeg.writeFile("input", new Uint8Array(await file.arrayBuffer()));
    // `ffmpeg -i` without an output exits non-zero but dumps all metadata
    // into the log, which is what we parse
    await ffmpeg.exec(["-hide_banner", "-i", "input"]).catch(() => {});

    const { tags, streams } = parseFfmpegLog(logs);

    // extract embedded cover art (marked as "attached pic" in the stream list)
    let coverUrl: string | null = null;
    if (streams.some((s) => s.includes("attached pic"))) {
      try {
        await ffmpeg.exec([
          "-i",
          "input",
          "-map",
          "0:v",
          "-frames:v",
          "1",
          "cover.png",
        ]);
        const data = await ffmpeg.readFile("cover.png");
        if (typeof data !== "string" && data.length > 0) {
          const buffer = new Uint8Array(data).buffer as ArrayBuffer;
          coverUrl = URL.createObjectURL(
            new Blob([buffer], { type: "image/png" }),
          );
        }
      } catch {
        // no extractable cover — ignore
      }
    }

    for (const name of ["input", "cover.png"]) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        // file may not exist — ignore
      }
    }

    return { tags, streams, coverUrl };
  } finally {
    ffmpeg.off("log", onLog);
  }
}
