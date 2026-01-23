"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Hash,
  User,
  Palette,
  Type,
  Code,
  Sun,
  Moon,
  Laptop,
  Check,
  SettingsIcon,
  Tags,
  SunMoon,
  SquareFunction,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { getSearchData } from "@/app/actions/search";
import type { SearchResult } from "@/lib/search";
import { useTheme } from "@/components/theme-provider";
import { getAllThemes } from "@/config/themes";
import { FONT_SIZES } from "@/config/font-sizes";

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

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [allResults, setAllResults] = React.useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const router = useRouter();
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

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (open && allResults.length === 0) {
      // Load all searchable content when dialog opens for the first time
      getSearchData().then((data) => {
        setAllResults(data);
        setSearchResults(data);
      });
    } else if (open) {
      setSearchResults(allResults);
    }
  }, [open, allResults]);

  const handleSearch = React.useCallback(
    (search: string) => {
      setSearchQuery(search);

      if (!search || search.trim().length === 0) {
        setSearchResults(allResults);
        return;
      }

      const lowerQuery = search.toLowerCase();

      // Filter content results
      const filtered = allResults.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(lowerQuery);
        const descriptionMatch = item.description
          ?.toLowerCase()
          .includes(lowerQuery);
        return titleMatch || descriptionMatch;
      });

      // Create settings search results
      const settingsResults: SearchResult[] = [];

      // Check appearance settings
      const appearanceMatches = [
        "appearance",
        "light",
        "dark",
        "system",
        "theme",
      ].some(
        (keyword) =>
          keyword.includes(lowerQuery) || lowerQuery.includes(keyword),
      );
      if (appearanceMatches) {
        const matchingAppearance = [
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system", label: "System" },
        ].filter((opt) => opt.label.toLowerCase().includes(lowerQuery));

        matchingAppearance.forEach((opt) => {
          settingsResults.push({
            type: "settings",
            title: `${opt.label} Mode`,
            description: "Appearance setting",
            url: `#appearance-${opt.value}`,
          });
        });
      }

      // Check color theme settings
      const themeMatches = ["color", "theme", "palette"].some(
        (keyword) =>
          keyword.includes(lowerQuery) || lowerQuery.includes(keyword),
      );
      if (themeMatches || lowerQuery.length > 2) {
        const themes = getAllThemes();
        const matchingThemes = themes.filter(
          (t) =>
            t.label.toLowerCase().includes(lowerQuery) ||
            t.name.toLowerCase().includes(lowerQuery),
        );

        matchingThemes.forEach((t) => {
          settingsResults.push({
            type: "settings",
            title: t.label,
            description: "Color theme",
            url: `#color-theme-${t.name}`,
          });
        });
      }

      // Check font size settings
      const fontSizeMatches = ["font", "size", "text"].some(
        (keyword) =>
          keyword.includes(lowerQuery) || lowerQuery.includes(keyword),
      );
      const matchingFontSizes = FONT_SIZES.filter(
        (fs) =>
          fs.label.toLowerCase().includes(lowerQuery) ||
          fs.value.toLowerCase().includes(lowerQuery),
      );

      if (fontSizeMatches || matchingFontSizes.length > 0) {
        matchingFontSizes.forEach((fs) => {
          settingsResults.push({
            type: "settings",
            title: `${fs.label} Font Size`,
            description: "Font size setting",
            url: `#font-size-${fs.value}`,
          });
        });
      }

      // Check font family settings
      const fontFamilyMatches = ["font", "family", "typeface"].some(
        (keyword) =>
          keyword.includes(lowerQuery) || lowerQuery.includes(keyword),
      );
      const matchingFontFamilies = FONT_FAMILIES.filter(
        (ff) =>
          ff.label.toLowerCase().includes(lowerQuery) ||
          ff.value.toLowerCase().includes(lowerQuery),
      );

      if (fontFamilyMatches || matchingFontFamilies.length > 0) {
        matchingFontFamilies.forEach((ff) => {
          settingsResults.push({
            type: "settings",
            title: ff.label,
            description: "Font family",
            url: `#font-family-${ff.value}`,
          });
        });
      }

      // Check code font family settings
      const codeFontMatches = ["code", "font", "mono", "monospace"].some(
        (keyword) =>
          keyword.includes(lowerQuery) || lowerQuery.includes(keyword),
      );
      const matchingCodeFontFamilies = CODE_FONT_FAMILIES.filter(
        (cff) =>
          cff.label.toLowerCase().includes(lowerQuery) ||
          cff.value.toLowerCase().includes(lowerQuery),
      );

      if (codeFontMatches || matchingCodeFontFamilies.length > 0) {
        matchingCodeFontFamilies.forEach((cff) => {
          settingsResults.push({
            type: "settings",
            title: cff.label,
            description: "Code font family",
            url: `#code-font-family-${cff.value}`,
          });
        });
      }

      // Check code theme settings
      const codeThemeMatches = ["code", "theme", "syntax", "highlighting"].some(
        (keyword) =>
          keyword.includes(lowerQuery) || lowerQuery.includes(keyword),
      );
      const matchingCodeThemes = CODE_THEMES.filter(
        (ct) =>
          ct.label.toLowerCase().includes(lowerQuery) ||
          ct.value.toLowerCase().includes(lowerQuery),
      );

      if (codeThemeMatches || matchingCodeThemes.length > 0) {
        matchingCodeThemes.forEach((ct) => {
          settingsResults.push({
            type: "settings",
            title: ct.label,
            description: "Code theme",
            url: `#code-theme-${ct.value}`,
          });
        });
      }

      // Combine content results and settings results
      setSearchResults([...filtered, ...settingsResults]);
    },
    [allResults],
  );

  const handleSelect = React.useCallback(
    (url: string) => {
      setOpen(false);

      // Handle settings URLs
      if (url.startsWith("#")) {
        const urlParts = url.substring(1).split("-");
        const settingType = urlParts[0];
        const settingSubType = urlParts[1];
        const value = urlParts.slice(2).join("-");

        if (settingType === "appearance") {
          setTheme(value as "light" | "dark" | "system");
        } else if (settingType === "color" && settingSubType === "theme") {
          setThemeName(value);
        } else if (settingType === "font" && settingSubType === "size") {
          setFontSize(value);
        } else if (settingType === "font" && settingSubType === "family") {
          setFontFamily(value);
        } else if (settingType === "code" && settingSubType === "font") {
          setCodeFontFamily(urlParts.slice(3).join("-"));
        } else if (settingType === "code" && settingSubType === "theme") {
          setCodeTheme(value);
        }
        return;
      }

      router.push(url);
    },
    [
      router,
      setTheme,
      setThemeName,
      setFontSize,
      setFontFamily,
      setCodeFontFamily,
      setCodeTheme,
    ],
  );

  const getIcon = (type: SearchResult["type"], description?: string) => {
    switch (type) {
      case "post":
        return <FileText className="mr-2 h-4 w-4" />;
      case "tag":
        return <Hash className="mr-2 h-4 w-4" />;
      case "author":
        return <User className="mr-2 h-4 w-4" />;
      case "settings":
        // Map icon based on settings description
        if (description?.includes("Appearance")) {
          return <SunMoon className="mr-2 h-4 w-4" />;
        } else if (description?.includes("Color theme")) {
          return <Palette className="mr-2 h-4 w-4" />;
        } else if (description?.includes("Font size")) {
          return <Type className="mr-2 h-4 w-4" />;
        } else if (
          description?.includes("Font family") ||
          description?.includes("font family")
        ) {
          return <Type className="mr-2 h-4 w-4" />;
        } else if (
          description?.includes("Code font") ||
          description?.includes("Code theme")
        ) {
          return <Code className="mr-2 h-4 w-4" />;
        }
        return <SettingsIcon className="mr-2 h-4 w-4" />;
    }
  };

  // Group results by type
  const posts = searchResults.filter((r) => r.type === "post");
  const tags = searchResults.filter((r) => r.type === "tag");
  const authors = searchResults.filter((r) => r.type === "author");
  const settingsResults = searchResults.filter((r) => r.type === "settings");

  const themes = getAllThemes();

  // Appearance settings - no custom filtering, let cmdk handle it via keywords
  const appearanceOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search posts, tags, authors, or settings..."
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {posts.length > 0 && (
          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <FileText className="h-4 w-4" />
              <span>Posts</span>
            </div>
            {posts.map((result) => (
              <CommandItem
                key={result.url}
                onSelect={() => handleSelect(result.url)}
                className="cursor-pointer"
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.description && (
                    <span className="text-xs text-muted-foreground">
                      {result.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {tags.length > 0 && (
          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <Tags className="h-4 w-4" />
              <span>Tags</span>
            </div>
            {tags.map((result) => (
              <CommandItem
                key={result.url}
                onSelect={() => handleSelect(result.url)}
                className="cursor-pointer"
              >
                {getIcon(result.type)}
                <span>{result.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {authors.length > 0 && (
          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <Users className="h-4 w-4" />
              <span>Authors</span>
            </div>
            {authors.map((result) => (
              <CommandItem
                key={result.url}
                onSelect={() => handleSelect(result.url)}
                className="cursor-pointer"
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.description && (
                    <span className="text-xs text-muted-foreground">
                      {result.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {settingsResults.length > 0 && (
          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <SettingsIcon className="h-4 w-4" />
              <span>Settings Results</span>
            </div>
            {settingsResults.map((result, index) => (
              <CommandItem
                key={`${result.title}-${index}`}
                onSelect={() => handleSelect(result.url)}
                className="cursor-pointer"
              >
                {getIcon(result.type, result.description)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.description && (
                    <span className="text-xs text-muted-foreground">
                      {result.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup>
          <div
            className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
            cmdk-group-heading=""
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Settings</span>
          </div>
          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <SunMoon className="h-4 w-4" />
              <span>Appearance</span>
            </div>
            {appearanceOptions.map((opt) => (
              <CommandItem
                key={opt.value}
                onSelect={() =>
                  setTheme(opt.value as "light" | "dark" | "system")
                }
                className="cursor-pointer"
              >
                <opt.icon className="mr-2 h-4 w-4" />
                <span>{opt.label}</span>
                {theme === opt.value && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <Palette className="h-4 w-4" />
              <span>Color Theme</span>
            </div>
            {themes.map((themeOption) => {
              const colors =
                resolvedTheme === "dark" ? themeOption.dark : themeOption.light;
              return (
                <CommandItem
                  key={themeOption.name}
                  onSelect={() => setThemeName(themeOption.name)}
                  className="cursor-pointer"
                >
                  <Palette className="mr-2 h-4 w-4" />
                  <div className="flex items-center gap-2">
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
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <Type className="h-4 w-4" />
              <span>Font Size</span>
            </div>
            {FONT_SIZES.map((fontSizeOption) => (
              <CommandItem
                key={fontSizeOption.value}
                onSelect={() => setFontSize(fontSizeOption.value)}
                className="cursor-pointer"
              >
                {fontSizeOption.icon && (
                  <fontSizeOption.icon className="mr-2 h-4 w-4" />
                )}
                <span>{fontSizeOption.label}</span>
                {fontSize === fontSizeOption.value && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <Type className="h-4 w-4" />
              <span>Font Family</span>
            </div>
            {FONT_FAMILIES.map((fontFamilyOption) => (
              <CommandItem
                key={fontFamilyOption.value}
                onSelect={() => setFontFamily(fontFamilyOption.value)}
                className="cursor-pointer"
              >
                <Type className="mr-2 h-4 w-4" />
                <span>{fontFamilyOption.label}</span>
                {fontFamily === fontFamilyOption.value && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <SquareFunction className="h-4 w-4" />
              <span>Code Font Family</span>
            </div>
            {CODE_FONT_FAMILIES.map((codeFontFamilyOption) => (
              <CommandItem
                key={codeFontFamilyOption.value}
                onSelect={() => setCodeFontFamily(codeFontFamilyOption.value)}
                className="cursor-pointer"
              >
                <SquareFunction className="mr-2 h-4 w-4" />
                <span>{codeFontFamilyOption.label}</span>
                {codeFontFamily === codeFontFamilyOption.value && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup>
            <div
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground"
              cmdk-group-heading=""
            >
              <Code className="h-4 w-4" />
              <span>Code Theme</span>
            </div>
            {CODE_THEMES.map((codeThemeOption) => (
              <CommandItem
                key={codeThemeOption.value}
                onSelect={() => setCodeTheme(codeThemeOption.value)}
                className="cursor-pointer"
              >
                <Code className="mr-2 h-4 w-4" />
                <span>{codeThemeOption.label}</span>
                {codeTheme === codeThemeOption.value && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
