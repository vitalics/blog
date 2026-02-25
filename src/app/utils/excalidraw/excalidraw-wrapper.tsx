"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, useState } from "react";

const ExcalidrawEditor = dynamic(
  () => import("@/components/excalidraw/excalidraw-editor"),
  { ssr: false },
);

export default function ExcalidrawWrapper() {
  // Capture the hash synchronously before Next.js router effects can clear it.
  // useLayoutEffect in this non-dynamic component fires before the dynamic
  // import resolves, so the hash is still intact here.
  const [initialHash, setInitialHash] = useState("");
  const captured = useRef(false);
  useLayoutEffect(() => {
    if (captured.current) return;
    captured.current = true;
    setInitialHash(window.location.hash);
  }, []);

  return <ExcalidrawEditor initialHash={initialHash} />;
}
