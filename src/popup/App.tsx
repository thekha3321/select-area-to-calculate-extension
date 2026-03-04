import { useState, useEffect, useCallback } from 'react'
import { runOCR } from '../utils/ocr'
import { calculateStats, evaluateFormula, Stats } from '../utils/calculations'
import { translations, getSavedLang, saveLang, Lang } from '../utils/i18n'

type AppState = 'idle' | 'selecting' | 'processing' | 'done' | 'error'

export default function App() {
  const [state, setState] = useState<AppState>('idle')
  const [image, setImage] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [progress, setProgress] = useState(0)
  const [formula, setFormula] = useState('')
  const [formulaResult, setFormulaResult] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [lang, setLang] = useState<Lang>(getSavedLang)

  const t = translations[lang]

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'vi' : 'en'
    setLang(next)
    saveLang(next)
  }

  // On open: check if background already stored a captured image
  useEffect(() => {
    chrome.action.setBadgeText({ text: '' })
    chrome.storage.local.get(['captureState', 'capturedImage', 'captureError'], (res) => {
      if (res.captureState === 'ready' && res.capturedImage) {
        chrome.storage.local.remove(['captureState', 'capturedImage'])
        processImage(res.capturedImage)
      } else if (res.captureState === 'error') {
        chrome.storage.local.remove(['captureState', 'captureError'])
        setError(res.captureError ?? t.captureFailed)
        setState('error')
      }
    })
  }, [])

  const processImage = useCallback(async (dataUrl: string) => {
    setImage(dataUrl)
    setState('processing')
    setProgress(0)
    try {
      const numbers = await runOCR(dataUrl, setProgress)
      if (numbers.length === 0) {
        setError(t.noNumbers)
        setState('error')
      } else {
        setStats(calculateStats(numbers))
        setState('done')
      }
    } catch (e) {
      setError('OCR failed: ' + String(e))
      setState('error')
    }
  }, [t])

  const handleCapture = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) return

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      })
      await chrome.tabs.sendMessage(tab.id, { type: 'startSelection' })

      setState('selecting')
    } catch (e) {
      setError('Cannot inject into this page: ' + String(e))
      setState('error')
    }
  }

  const handleFormula = () => {
    if (!stats) return
    try {
      const result = evaluateFormula(formula, stats.numbers)
      setFormulaResult(
        Number.isInteger(result) ? String(result) : result.toFixed(4),
      )
    } catch (e) {
      setFormulaResult('Error: ' + String(e))
    }
  }

  const reset = () => {
    setState('idle')
    setImage(null)
    setStats(null)
    setFormula('')
    setFormulaResult(null)
    setError('')
    setProgress(0)
  }

  return (
    <div className="app">
      <header className="header">
        <span className="logo">📊</span>
        <h1>{t.title}</h1>
        <button className="lang-btn" onClick={toggleLang} title="Switch language">
          {lang === 'en' ? '🇻🇳 VI' : '🇬🇧 EN'}
        </button>
      </header>

      {/* ── IDLE ── */}
      {state === 'idle' && (
        <div className="section center">
          <p className="hint">{t.hint}</p>
          <button className="btn primary" onClick={handleCapture}>
            {t.selectArea}
          </button>
        </div>
      )}

      {/* ── SELECTING ── */}
      {state === 'selecting' && (
        <div className="section center">
          <div className="spinner" />
          <p>{t.drawing}</p>
          <p className="hint">{t.pressEsc}</p>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {state === 'processing' && (
        <div className="section center">
          <div className="spinner" />
          <p>{t.runningOCR}</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="hint">{progress}%</p>
        </div>
      )}

      {/* ── DONE ── */}
      {state === 'done' && stats && (
        <div className="results">
          {image && (
            <div className="preview">
              <img src={image} alt="Captured area" />
            </div>
          )}

          <div className="section">
            <h2 className="section-title">{t.extractedNumbers} ({stats.count})</h2>
            <div className="chip-list">
              {stats.numbers.map((n, i) => (
                <span key={i} className="chip">{n.toLocaleString()}</span>
              ))}
            </div>
          </div>

          <div className="stats-grid">
            <StatCard label={t.sum}     value={stats.sum} />
            <StatCard label={t.average} value={stats.average} decimals={2} />
            <StatCard label={t.min}     value={stats.min} />
            <StatCard label={t.max}     value={stats.max} />
          </div>

          <div className="section">
            <h2 className="section-title">{t.customFormula}</h2>
            <p className="hint">
              {t.formulaHint} <code>SUM</code> <code>AVG</code> <code>MIN</code> <code>MAX</code> <code>COUNT</code>
            </p>
            <div className="formula-row">
              <input
                className="formula-input"
                type="text"
                placeholder={t.formulaPlaceholder}
                value={formula}
                onChange={(e) => { setFormula(e.target.value); setFormulaResult(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleFormula()}
              />
              <button className="btn small" onClick={handleFormula}>=</button>
            </div>
            {formulaResult !== null && (
              <div className="formula-result">= {formulaResult}</div>
            )}
          </div>

          <div className="action-row">
            <button className="btn primary" onClick={handleCapture}>{t.newCapture}</button>
            <button className="btn ghost" onClick={reset}>{t.reset}</button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {state === 'error' && (
        <div className="section center">
          <p className="error-msg">{error}</p>
          <button className="btn primary" onClick={reset}>{t.tryAgain}</button>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  decimals = 0,
}: {
  label: string
  value: number
  decimals?: number
}) {
  const display = decimals > 0 ? value.toFixed(decimals) : value.toLocaleString()
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{display}</span>
    </div>
  )
}
