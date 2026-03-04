import { createWorker, PSM, OEM } from 'tesseract.js'

export async function runOCR(
  imageDataUrl: string,
  onProgress: (pct: number) => void,
): Promise<number[]> {
  const base = chrome.runtime.getURL('tesseract/')

  // workerBlobURL:false → new Worker(workerPath) directly, so the worker
  // runs at the extension origin and can importScripts the core file.
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerBlobURL: false,
    workerPath: base + 'worker.min.js',
    corePath:   base + 'tesseract-core-lstm.wasm.js',
    langPath:   'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress(Math.round((m.progress as number) * 100))
      }
    },
  } as Parameters<typeof createWorker>[2])

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    // No char whitelist — it force-maps unknown chars (e.g. đ, $, %) to the
    // nearest digit, corrupting values like "0đ" → "04" → 4.
    // extractNumbers() already filters to digit sequences via regex.
  })

  const { data } = await worker.recognize(imageDataUrl)
  await worker.terminate()
  return extractNumbers(data.text)
}

function extractNumbers(text: string): number[] {
  // Strip currency symbols that follow digits.
  // đ = Vietnamese dong; OCR often reads it as d, D, or even 0/4.
  // Replace (\digit)(đ or d or D) → just the digit.
  const cleaned = text.replace(/(\d)[đdD]/g, '$1')

  const raw = cleaned.match(/-?\d[\d.,]*/g) ?? []
  return raw
    .map(parseLocaleNumber)
    .filter((n): n is number => !isNaN(n) && isFinite(n))
}

/**
 * Parses numbers in Vietnamese (1.920.000) and Western (1,920,000 / 1.5) formats.
 *
 * Thousands-separator rule for dots:
 *   - All MIDDLE groups must be exactly 3 digits.
 *   - Last group may be 3 OR 4 digits (4 = OCR artifact when đ was read as a digit).
 *     In that case only the first 3 digits of the last group are kept.
 *
 *   "1.920.000"  → 1920000   "107.006"   → 107006
 *   "-20.000"    → -20000    "1.920.0000"→ 1920000  (đ→0 OCR artifact)
 *   "1.5"        → 1.5       "1,920,000" → 1920000   "1,5" → 1.5
 */
function parseLocaleNumber(raw: string): number {
  const s = raw.replace(/[.,]+$/, '')    // strip trailing separators
  if (!s || s === '-') return NaN

  const hasDot   = s.includes('.')
  const hasComma = s.includes(',')

  // Both separators → whichever is last is the decimal point
  if (hasDot && hasComma) {
    return s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))                      // "1,234.56"
      : parseFloat(s.replace(/\./g, '').replace(',', '.'))   // "1.234,56"
  }

  if (hasDot) {
    const parts = s.split('.')
    const mid   = parts.slice(1, -1)
    const last  = parts[parts.length - 1]
    const midOk  = mid.every(p => /^\d{3}$/.test(p))
    const lastOk = /^\d{3,4}$/.test(last)

    if (midOk && lastOk) {
      // Thousands separator — clamp last group to 3 digits (drops OCR artifact digit)
      const cleanLast = last.slice(0, 3)
      return parseFloat([...parts.slice(0, -1), cleanLast].join(''))
    }
    return parseFloat(s)   // decimal: "1.5"
  }

  if (hasComma) {
    const parts = s.split(',')
    const mid   = parts.slice(1, -1)
    const last  = parts[parts.length - 1]
    const midOk  = mid.every(p => /^\d{3}$/.test(p))
    const lastOk = /^\d{3,4}$/.test(last)

    if (midOk && lastOk) {
      const cleanLast = last.slice(0, 3)
      return parseFloat([...parts.slice(0, -1), cleanLast].join(''))
    }
    return parseFloat(s.replace(',', '.'))   // decimal: "1,5"
  }

  return parseFloat(s)
}
