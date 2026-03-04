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
    tessedit_char_whitelist: '0123456789.,-+',
  })

  const { data } = await worker.recognize(imageDataUrl)
  await worker.terminate()
  return extractNumbers(data.text)
}

function extractNumbers(text: string): number[] {
  // Match integers and decimals, including negative and comma-formatted numbers
  const matches = text.match(/-?[\d,]+\.?\d*/g) ?? []
  return matches
    .map((s) => parseFloat(s.replace(/,/g, '')))
    .filter((n) => !isNaN(n) && isFinite(n))
}
