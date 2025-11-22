# Image Processing Migration to Jimp

## Why we switched
- `sharp` bundles platform-specific native binaries that routinely broke our cross-platform builds.
- `jimp` is a pure JavaScript library that ships the same code for macOS, Windows, and Linux, eliminating native rebuilds.
- We accept the trade-off of slower processing and the lack of WebP/AVIF encoding support.

## Project changes
- Removed `sharp` and all platform-specific `@img/sharp-*` optional dependencies.
- Added `jimp` to both `package.json` files (root and `release/app`).
- Reverted `asarUnpack` and webpack externals to no longer special-case sharp.
- Updated `file-conversion-service.ts`:
  - Image-to-PDF now falls back to Jimp for PNG conversion when the input format is unsupported by `pdf-lib`.
  - Image conversion supports: `png`, `jpg/jpeg`, `bmp`, `gif`, and `tif/tiff`. Requests for `webp` and `avif` now throw a descriptive error.
  - Image resize keeps the previous “fit inside” semantics via manual aspect-ratio math.

## Supported image operations with Jimp
- **Read/Write formats**: PNG, JPEG, BMP, GIF, TIFF.
- **Conversions**: limited to the formats above. WebP/AVIF output is no longer available.
- **Resize**: preserves aspect ratio and fits within requested dimensions.
- **Images → PDF**: still supported; unsupported formats are converted to PNG first.

## Developer checklist
1. `npm install` in the project root and in `release/app` to pick up `jimp`.
2. Remove leftover `node_modules/sharp` directories if they exist (old installs).
3. Run `npm run build` or any targeted build script—no native rebuild step is required anymore.
4. Manually test the MCP image tools:
   - `image_convert` for PNG ⇄ JPEG, BMP, GIF, TIFF.
   - `image_resize` for width-only, height-only, and width+height.
   - `images_to_pdf` with at least one unsupported format to confirm the PNG fallback.

## Known limitations / follow-ups
- WebP and AVIF generation is no longer available. If required later, consider a lightweight specialized encoder just for those targets.
- Jimp is significantly slower on very large images; keep batch sizes reasonable or queue jobs.
- Animated GIF output remains single-frame due to Jimp limitations.

## References
- [Jimp documentation](https://jimp-dev.github.io/jimp/)
- [Jimp API on npm](https://www.npmjs.com/package/jimp)

