# Project Context — Select Area to Calculate Extension

Chrome MV3 extension. User drag-selects an area on any page → OCR extracts numbers → shows stats + custom formula.
GitHub: https://github.com/thekha3321/select-area-to-calculate-extension
Build: `npm run build` → `dist/` (load unpacked in chrome://extensions)

---

## File Map

| File | Role |
|------|------|
| `src/content/index.ts` | Overlay + drag selection on page |
| `src/background/index.ts` | Screenshot capture, crop, storage, reopen popup |
| `src/popup/App.tsx` | React UI, state machine, language toggle |
| `src/popup/styles.css` | All styles |
| `src/utils/ocr.ts` | Tesseract.js OCR setup |
| `src/utils/calculations.ts` | Stats + recursive descent formula parser |
| `src/utils/i18n.ts` | EN/VI translations + localStorage persistence |
| `public/manifest.json` | MV3 manifest, permissions, CSP, web_accessible_resources |
| `vite.config.ts` | Builds popup/background/content + copies tesseract files |

---

## Full Flow

1. Popup → injects `content.js` → sends `startSelection`
2. Content script shows dim overlay + crosshair; user drags to select
3. `onUp` → cleanup overlay → 80ms delay → sends `selectionDone {x,y,width,height,dpr}` to background
4. Background: `captureVisibleTab()` → `dataUrlToBlob()` → `createImageBitmap` → `OffscreenCanvas` crop → base64 → `chrome.storage.local`
5. Background calls `chrome.action.openPopup()` (badge fallback if it fails)
6. Popup `useEffect` on mount: clears badge, reads storage, calls `processImage()`
7. `processImage` → `runOCR()` → `calculateStats()` → renders results

---

## Critical Bugs Fixed (never revert these)

### 1. Selection box invisible
`box.style.display = 'block !important'` is silently ignored in JS.
**Fix:** `box.style.setProperty('display', 'block', 'important')`

### 2. Box position override by page CSS
`onMove` sets `left/top/width/height` without `!important` — page CSS can win over `all: initial`.
**Fix:** use `setProperty('left', x+'px', 'important')` etc.

### 3. `fetch(dataUrl)` fails in MV3 service worker
`data:` URLs are not fetchable in MV3 background service workers.
**Fix:** `dataUrlToBlob()` using `atob()` + `Uint8Array` (see background/index.ts)

### 4. Tesseract `importScripts` NetworkError
Tesseract.js defaults `workerBlobURL: true` → creates a blob worker → blob worker calls
`importScripts('chrome-extension://...')` → Chrome blocks it even with `web_accessible_resources`.
**Fix:** Pass `workerBlobURL: false` in `createWorker` options → Tesseract does `new Worker(workerPath)`
directly, worker runs at extension origin, `importScripts` works.

### 5. Formula eval CSP violation
`Function("return " + expr)` is blocked by `script-src 'self'` (same as eval).
**Fix:** Recursive descent parser in `calculations.ts` — no eval/Function, supports `+-*/%()` + unary `-`.

### 6. Popup closes during selection — nothing happens
After clicking Select Area the popup loses focus and closes. Background stores result but popup is gone.
**Fix:** Background calls `chrome.action.openPopup()` after storing. Badge fallback if that fails.

---

## Manifest Permissions & CSP

```json
"permissions": ["activeTab", "scripting", "storage", "tabs"],
"host_permissions": ["<all_urls>"],
"web_accessible_resources": [{
  "resources": ["tesseract/worker.min.js", "tesseract/tesseract-core-lstm.wasm.js"],
  "matches": ["<all_urls>"]
}],
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' blob: https://tessdata.projectnaptha.com; object-src 'self'"
}
```
- `blob:` must NOT be in `script-src` — Chrome MV3 rejects it
- `'wasm-unsafe-eval'` required for Tesseract WASM
- `web_accessible_resources` is kept but NOT the real fix for the importScripts issue

---

## Tesseract Setup

- `worker.min.js` + `tesseract-core-lstm.wasm.js` bundled to `dist/tesseract/` via `vite-plugin-static-copy`
- `workerBlobURL: false` — the only correct way to use Tesseract in a Chrome MV3 extension
- Lang data fetched from `https://tessdata.projectnaptha.com/4.0.0` at runtime (cached by browser)
- `PSM.SPARSE_TEXT` + whitelist `0123456789.,-+`

---

## i18n

- `src/utils/i18n.ts` — `translations` object with `en` and `vi` keys
- Toggle button in header (top-right): shows opposite lang flag+code
- Persisted with `localStorage.setItem('lang', ...)`
- Add new language: add key to `translations` object + add to `Lang` type

---

## Stack

- React 18, TypeScript, Vite 5, Tesseract.js 5.1.1
- No UI library — plain CSS custom properties (dark theme)
- No state management — plain `useState`/`useCallback`
