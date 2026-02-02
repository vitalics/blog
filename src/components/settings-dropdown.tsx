"use client";

import {
  Settings,
  Check,
  Palette,
  Type,
  Code,
  Sun,
  Moon,
  Laptop,
  SunMoon,
  SquareFunction,
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { getAllThemes } from "@/config/themes";
import { FONT_SIZES } from "@/config/font-sizes";
import { useState } from "react";

const FONT_FAMILIES = [
  { value: "geist", label: "Geist" },
  { value: "system", label: "System Default" },
  { value: "serif", label: "Serif" },
  { value: "arial", label: "Arial" },
  { value: "verdana", label: "Verdana" },
  { value: "tahoma", label: "Tahoma" },
] as const;

const CODE_FONT_FAMILIES = [
  { value: "geist-mono", label: "Geist Mono" },
  { value: "operator-mono", label: "Operator Mono" },
  { value: "jetbrains-mono", label: "JetBrains Mono" },
  { value: "maple-mono", label: "Maple Mono" },
  { value: "mono", label: "System Mono" },
  { value: "consolas", label: "Consolas" },
  { value: "courier", label: "Courier New" },
] as const;

const CODE_THEMES = [
  { value: "github", label: "GitHub" },
  { value: "dracula", label: "Dracula" },
  { value: "nord", label: "Nord" },
  { value: "monokai", label: "Monokai" },
  { value: "catppuccin", label: "Catppuccin" },
] as const;

type SettingsSection =
  | "main"
  | "theme"
  | "fontSize"
  | "fontFamily"
  | "codeFontFamily"
  | "codeTheme"
  | "appearance";

export function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("main");
  const {
    theme,
    setTheme,
    themeName,
    setThemeName,
    resolvedTheme,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    codeFontFamily,
    setCodeFontFamily,
    codeTheme,
    setCodeTheme,
  } = useTheme();

  const themes = getAllThemes();

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setSection("main"), 200);
  };

  const renderMainMenu = () => (
    <>
      <div className="mb-2 px-2 text-sm font-semibold text-muted-foreground">
        Settings
      </div>
      <div className="space-y-1">
        <button
          onClick={() => setSection("appearance")}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <SunMoon className="h-4 w-4" />
            <span>Appearance</span>
          </div>
          <span className="text-xs text-muted-foreground capitalize">
            {theme}
          </span>
        </button>

        <button
          onClick={() => setSection("theme")}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span>Color Theme</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {themes.find((t) => t.name === themeName)?.label}
          </span>
        </button>

        <button
          onClick={() => setSection("fontSize")}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            <span>Font Size</span>
          </div>
          <span className="text-xs text-muted-foreground capitalize">
            {FONT_SIZES.find((f) => f.value === fontSize)?.label}
          </span>
        </button>

        <button
          onClick={() => setSection("fontFamily")}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            <span>Font Family</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {FONT_FAMILIES.find((f) => f.value === fontFamily)?.label}
          </span>
        </button>

        <button
          onClick={() => setSection("codeFontFamily")}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <SquareFunction className="h-4 w-4" />
            <span>Code Font Family</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {CODE_FONT_FAMILIES.find((f) => f.value === codeFontFamily)?.label}
          </span>
        </button>

        <button
          onClick={() => setSection("codeTheme")}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <span>Code Theme</span>
          </div>
          <span className="text-xs text-muted-foreground capitalize">
            {CODE_THEMES.find((t) => t.value === codeTheme)?.label}
          </span>
        </button>
      </div>
    </>
  );

  const renderAppearanceMenu = () => (
    <>
      <div className="mb-2 flex items-center gap-2 px-2">
        <button
          onClick={() => setSection("main")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-muted-foreground">
          Appearance
        </div>
      </div>
      <div className="space-y-1">
        {[
          { value: "light", label: "Light", icon: Sun },
          { value: "dark", label: "Dark", icon: Moon },
          { value: "system", label: "System", icon: Laptop },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() => {
              setTheme(item.value as "light" | "dark" | "system");
              handleClose();
            }}
            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
            {theme === item.value && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}
      </div>
    </>
  );

  const renderThemeMenu = () => (
    <>
      <div className="mb-2 flex items-center gap-2 px-2">
        <button
          onClick={() => setSection("main")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-muted-foreground">
          Color Theme
        </div>
      </div>
      <div className="space-y-1">
        {themes.map((themeOption) => {
          const colors =
            resolvedTheme === "dark" ? themeOption.dark : themeOption.light;
          return (
            <button
              key={themeOption.name}
              onClick={() => {
                setThemeName(themeOption.name);
                handleClose();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <div className="flex gap-0.5">
                  <div
                    className="h-3 w-3 rounded-full border border-border/50"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <div
                    className="h-3 w-3 rounded-full border border-border/50"
                    style={{ backgroundColor: colors.secondary }}
                  />
                  <div
                    className="h-3 w-3 rounded-full border border-border/50"
                    style={{ backgroundColor: colors.accent }}
                  />
                </div>
                <span>{themeOption.label}</span>
              </div>
              {themeName === themeOption.name && (
                <Check className="h-4 w-4 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );

  const renderFontSizeMenu = () => (
    <>
      <div className="mb-2 flex items-center gap-2 px-2">
        <button
          onClick={() => setSection("main")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-muted-foreground">
          Font Size
        </div>
      </div>
      <div className="space-y-1">
        {FONT_SIZES.map((fontSizeOption) => (
          <button
            key={fontSizeOption.value}
            onClick={() => {
              setFontSize(fontSizeOption.value);
              handleClose();
            }}
            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center gap-2">
              <fontSizeOption.icon className="h-4 w-4" />
              <span>{fontSizeOption.label}</span>
            </div>
            {fontSize === fontSizeOption.value && (
              <Check className="h-4 w-4 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </>
  );

  const renderFontFamilyMenu = () => (
    <>
      <div className="mb-2 flex items-center gap-2 px-2">
        <button
          onClick={() => setSection("main")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-muted-foreground">
          Font Family
        </div>
      </div>
      <div className="space-y-1">
        {FONT_FAMILIES.map((fontFamilyOption) => (
          <button
            key={fontFamilyOption.value}
            onClick={() => {
              setFontFamily(fontFamilyOption.value);
              handleClose();
            }}
            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              <span>{fontFamilyOption.label}</span>
            </div>
            {fontFamily === fontFamilyOption.value && (
              <Check className="h-4 w-4 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </>
  );

  const renderCodeFontFamilyMenu = () => (
    <>
      <div className="mb-2 flex items-center gap-2 px-2">
        <button
          onClick={() => setSection("main")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-muted-foreground">
          Code Font Family
        </div>
      </div>
      <div className="space-y-1">
        {CODE_FONT_FAMILIES.map((codeFontFamilyOption) => (
          <button
            key={codeFontFamilyOption.value}
            onClick={() => {
              setCodeFontFamily(codeFontFamilyOption.value);
              handleClose();
            }}
            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="font-mono">{codeFontFamilyOption.label}</span>
            </div>
            {codeFontFamily === codeFontFamilyOption.value && (
              <Check className="h-4 w-4 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </>
  );

  const renderCodeThemeMenu = () => (
    <>
      <div className="mb-2 flex items-center gap-2 px-2">
        <button
          onClick={() => setSection("main")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-muted-foreground">
          Code Theme
        </div>
      </div>
      <div className="space-y-1">
        {CODE_THEMES.map((codeThemeOption) => (
          <button
            key={codeThemeOption.value}
            onClick={() => {
              setCodeTheme(codeThemeOption.value);
              handleClose();
            }}
            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span>{codeThemeOption.label}</span>
            </div>
            {codeTheme === codeThemeOption.value && (
              <Check className="h-4 w-4 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 hover:bg-accent"
        aria-label="Settings"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={handleClose} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border bg-popover p-2 shadow-lg max-h-[80vh] overflow-y-auto">
            {section === "main" && renderMainMenu()}
            {section === "appearance" && renderAppearanceMenu()}
            {section === "theme" && renderThemeMenu()}
            {section === "fontSize" && renderFontSizeMenu()}
            {section === "fontFamily" && renderFontFamilyMenu()}
            {section === "codeFontFamily" && renderCodeFontFamilyMenu()}
            {section === "codeTheme" && renderCodeThemeMenu()}
          </div>
        </>
      )}
    </div>
  );
}
