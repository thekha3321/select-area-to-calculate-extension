// Content script — injected into the active tab
// Draws a selection overlay so the user can pick an area

// Guard against double-injection
if (!(window as any).__tableCalcLoaded) {
  ;(window as any).__tableCalcLoaded = true

  let overlay: HTMLDivElement | null = null
  let box: HTMLDivElement | null = null
  let startX = 0
  let startY = 0
  let dragging = false

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'startSelection') startSelection()
  })

  function startSelection() {
    cleanup()

    // Dim overlay
    overlay = document.createElement('div')
    overlay.style.cssText = `
      all: initial;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
      background: rgba(0,0,0,0.35) !important;
    `

    // Selection rectangle
    box = document.createElement('div')
    box.style.cssText = `
      all: initial;
      position: fixed !important;
      border: 2px solid #22c55e !important;
      background: rgba(34,197,94,0.12) !important;
      pointer-events: none !important;
      display: none !important;
    `

    // Instruction label
    const label = document.createElement('div')
    label.textContent = 'Drag to select the table area  •  ESC to cancel'
    label.style.cssText = `
      all: initial;
      position: fixed !important;
      top: 16px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: #1e1e2e !important;
      color: #cdd6f4 !important;
      font: 13px/1.4 system-ui, sans-serif !important;
      padding: 8px 16px !important;
      border-radius: 8px !important;
      pointer-events: none !important;
      white-space: nowrap !important;
      z-index: 2147483647 !important;
    `

    overlay.appendChild(box)
    overlay.appendChild(label)
    document.documentElement.appendChild(overlay)

    overlay.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
  }

  function onDown(e: MouseEvent) {
    dragging = true
    startX = e.clientX
    startY = e.clientY
    if (box) box.style.setProperty('display', 'block', 'important')
    overlay!.addEventListener('mousemove', onMove)
    overlay!.addEventListener('mouseup', onUp)
  }

  function onMove(e: MouseEvent) {
    if (!dragging || !box) return
    const x = Math.min(e.clientX, startX)
    const y = Math.min(e.clientY, startY)
    const w = Math.abs(e.clientX - startX)
    const h = Math.abs(e.clientY - startY)
    box.style.setProperty('left', x + 'px', 'important')
    box.style.setProperty('top', y + 'px', 'important')
    box.style.setProperty('width', w + 'px', 'important')
    box.style.setProperty('height', h + 'px', 'important')
  }

  function onUp(e: MouseEvent) {
    if (!dragging) return
    dragging = false

    const x = Math.min(e.clientX, startX)
    const y = Math.min(e.clientY, startY)
    const width = Math.abs(e.clientX - startX)
    const height = Math.abs(e.clientY - startY)

    cleanup()

    if (width > 10 && height > 10) {
      // Small delay so the overlay is gone before screenshot
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'selectionDone',
          rect: { x, y, width, height, dpr: window.devicePixelRatio },
        })
      }, 80)
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') cleanup()
  }

  function cleanup() {
    overlay?.remove()
    overlay = null
    box = null
    dragging = false
    document.removeEventListener('keydown', onKey)
  }
}
