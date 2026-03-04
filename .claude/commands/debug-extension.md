# Debug Table Calculator Extension

Perform a full review and trace of the extension. Check each layer in order:

## 1. Build
Run `npm run build` and confirm no errors. Check that `dist/tesseract/` contains both `worker.min.js` and `tesseract-core-lstm.wasm.js`.

## 2. Manifest
Read `public/manifest.json` and verify:
- Permissions include: `activeTab`, `scripting`, `storage`, `tabs`
- `host_permissions` is `<all_urls>`
- CSP `connect-src` includes `blob:` and `https://tessdata.projectnaptha.com`
- CSP `script-src` includes `'wasm-unsafe-eval'`

## 3. Content script (`src/content/index.ts`)
Trace the selection flow:
- Overlay uses `all: initial` + `!important` on every property — verify all `style.set*` calls use `setProperty(..., 'important')`
- `display: block` on mousedown uses `setProperty('display', 'block', 'important')` — NOT `style.display = 'block !important'`
- `left/top/width/height` in `onMove` use `setProperty(..., 'important')`
- `cleanup()` removes overlay and keydown listener

## 4. Background (`src/background/index.ts`)
Trace capture flow:
- `chrome.tabs.captureVisibleTab` → data URL
- `dataUrlToBlob()` decodes base64 WITHOUT `fetch()` (fetch of data: URLs fails in MV3 service workers)
- `createImageBitmap(blob)` → OffscreenCanvas crop → base64 output
- Result stored in `chrome.storage.local` as `captureState: 'ready'`
- `chrome.action.openPopup()` called after storing — badge fallback if it fails

## 5. Popup (`src/popup/App.tsx`)
Trace on-open flow:
- `useEffect` on mount clears badge, reads storage
- If `captureState === 'ready'` → calls `processImage(capturedImage)`
- `processImage` → `runOCR` → `calculateStats` → shows results

## 6. OCR (`src/utils/ocr.ts`)
- Worker and core files are fetched from `chrome.runtime.getURL('tesseract/')` IN THE POPUP CONTEXT, then converted to blob: URLs
- WHY: Tesseract wraps workerPath in a blob that calls importScripts() — a blob worker can't importScripts a chrome-extension:// URL, but it CAN importScripts another blob: URL from the same origin
- `langPath` fetches `eng.traineddata.gz` from `tessdata.projectnaptha.com` (requires network)
- `PSM.SPARSE_TEXT` + whitelist `0123456789.,-+`
- CSP must include `blob:` in BOTH `script-src` AND `connect-src`

## Known bugs already fixed
- `style.display = 'block !important'` → must use `setProperty`
- `fetch(dataUrl)` in service worker → must use `dataUrlToBlob()` instead
- `onMove` position properties missing `!important` → use `setProperty`
- Tesseract `importScripts` on chrome-extension:// URL fails in blob worker → fetch both files and pass blob: URLs as workerPath/corePath
