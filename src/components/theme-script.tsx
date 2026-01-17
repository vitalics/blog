export function ThemeScript() {
  const script = `
    (function() {
      const storageKey = 'blog-theme';
      const themeNameKey = 'blog-theme-name';
      const codeThemeKey = 'blog-code-theme';
      const theme = localStorage.getItem(storageKey) || 'system';
      const themeName = localStorage.getItem(themeNameKey) || 'default';
      const codeTheme = localStorage.getItem(codeThemeKey) || 'github';
      const root = document.documentElement;
      
      const themes = ${JSON.stringify(require('@/config/themes').THEMES)};
      
      let effectiveTheme = 'light';
      
      if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        effectiveTheme = theme;
      }
      
      root.classList.add(effectiveTheme);
      root.setAttribute('data-code-theme', codeTheme);
      root.setAttribute('data-theme-mode', effectiveTheme);
      
      // Apply theme colors
      const themeConfig = themes[themeName] || themes.default;
      const colors = effectiveTheme === 'dark' ? themeConfig.dark : themeConfig.light;
      
      Object.entries(colors).forEach(([key, value]) => {
        const cssVarName = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(cssVarName, value);
      });
    })();
  `

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  )
}
