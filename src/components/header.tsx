"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { SITE } from "@/config/site";
import { useState, useEffect } from "react";

// Placeholder component for deferred loading
const DeferredPlaceholder = () => <div className="h-9 w-9" />;

// Dynamically load components to improve FCP
const SettingsDropdown = dynamic(
  () =>
    import("@/components/settings-dropdown").then((mod) => ({
      default: mod.SettingsDropdown,
    })),
  {
    ssr: false,
    loading: () => <DeferredPlaceholder />,
  },
);

const NavMenu = dynamic(() => import("@/components/ui/nav-menu"), {
  ssr: false,
  loading: () => <DeferredPlaceholder />,
});

export function Header() {
  // Defer rendering of non-critical components until after initial paint
  const [showDeferred, setShowDeferred] = useState(false);

  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleDeferred =
      window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1));
    const id = scheduleDeferred(() => setShowDeferred(true));
    return () => {
      if (window.cancelIdleCallback) {
        window.cancelIdleCallback(id as number);
      }
    };
  }, []);

  const handleSearchClick = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            <span className="hidden sm:inline-block">{SITE.TITLE}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSearchClick}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          {/* Settings dropdown - unified across all screen sizes */}
          {showDeferred ? <SettingsDropdown /> : <DeferredPlaceholder />}

          {/* Navigation menu - unified across all screen sizes */}
          {showDeferred ? <NavMenu /> : <DeferredPlaceholder />}
        </div>
      </div>
    </header>
  );
}
