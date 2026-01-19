# Installing Maple Mono Font

To use the Maple Mono font in this blog, you need to download the font files and place them in this directory.

## Download Instructions

1. Go to the Maple Mono releases page:
   https://github.com/subframe7536/maple-font/releases/tag/v7.9

2. Download the **WOFF2** format font package. We recommend:
   - **Normal-Ligature** if you want ligatures (combined characters like `=>` becoming `⇒`)
   - **Normal-No-Ligature** if you prefer plain characters

3. Extract the downloaded archive

4. Copy the following font files to this directory (`public/fonts/`):
   - `MapleMono-Regular.woff2`
   - `MapleMono-Bold.woff2`
   - `MapleMono-Italic.woff2`
   - `MapleMono-BoldItalic.woff2`

   Note: The exact filenames may vary depending on the package you downloaded. You may need to rename them to match the names above.

## Alternative: Use CDN (Quick Setup)

If you don't want to download the fonts locally, you can use a CDN by updating `src/app/fonts.css`:

```css
@font-face {
  font-family: 'Maple Mono';
  src: url('https://cdn.jsdelivr.net/gh/subframe7536/maple-font@v7.9/dist/WOFF2/MapleMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* Add other weights and styles as needed */
```

## Verify Installation

After placing the font files:
1. Restart your development server
2. Open your blog in the browser
3. Select "Maple Mono" from the Code Font selector in the header
4. The code blocks should now use the Maple Mono font

## Troubleshooting

- If the font doesn't load, check the browser console for 404 errors
- Verify the font files are in the correct directory: `public/fonts/`
- Make sure the filenames in `src/app/fonts.css` match your actual file names
