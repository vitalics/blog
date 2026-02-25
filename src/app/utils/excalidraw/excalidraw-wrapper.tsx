"use client";

import dynamic from "next/dynamic";

const ExcalidrawEditor = dynamic(
  () => import("@/components/excalidraw/excalidraw-editor"),
  { ssr: false },
);

export default function ExcalidrawWrapper() {
  return <ExcalidrawEditor />;
}
