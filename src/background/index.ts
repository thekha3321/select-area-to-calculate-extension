// Background service worker
// Handles: screenshot capture, image cropping, storage

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'selectionDone') {
    handleCapture(message.rect)
    sendResponse({ ok: true })
  }
  return false
})

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
  dpr: number
}

async function handleCapture(rect: SelectionRect) {
  try {
    // Capture the visible tab as PNG
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })

    // Crop to the selected rectangle
    const cropped = await cropImage(dataUrl, rect)

    // Store result for popup to pick up
    await chrome.storage.local.set({
      captureState: 'ready',
      capturedImage: cropped,
    })
  } catch (err) {
    await chrome.storage.local.set({
      captureState: 'error',
      captureError: String(err),
    })
  }

  // Re-open the popup so the user sees the result
  try {
    await (chrome.action as any).openPopup()
  } catch {
    // Fallback: show a badge so user knows to click the icon
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function cropImage(dataUrl: string, rect: SelectionRect): Promise<string> {
  const { x, y, width, height, dpr } = rect

  // Decode without fetch (data: URLs fail in MV3 service workers)
  const blob = dataUrlToBlob(dataUrl)
  const bitmap = await createImageBitmap(blob)

  const pw = Math.round(width * dpr)
  const ph = Math.round(height * dpr)

  const canvas = new OffscreenCanvas(pw, ph)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    bitmap,
    Math.round(x * dpr),
    Math.round(y * dpr),
    pw,
    ph,
    0,
    0,
    pw,
    ph,
  )

  const outBlob = await canvas.convertToBlob({ type: 'image/png' })
  const buf = await outBlob.arrayBuffer()
  const bytes = new Uint8Array(buf)

  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return `data:image/png;base64,${btoa(binary)}`
}
