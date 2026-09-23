import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eraser, FileText, PenLine, Sparkles, UploadCloud } from 'lucide-react'
import DocMetaBar from '../components/analyze/DocMetaBar'
import AnalysisProgress from '../components/analyze/AnalysisProgress'
import FileDrop, { PLANNED_FORMATS } from '../components/analyze/FileDrop'
import ErrorCard from '../components/ui/ErrorCard'
import { extractDocument, validateDocument } from '../services/apiClient'
import { analyzeLegalDocument } from '../services/legalAnalysisService'
import { useAnalysis } from '../context/AnalysisContext'
import { countWords } from '../utils/text.js'
import { SAMPLE_DOCUMENT } from '../utils/sampleDocument.js'

const LIMITS = { maxFileBytes: 512 * 1024, maxTextChars: 60000, minTextChars: 80 }
const extensionOf = (name) => {
  const n = (name || '').toLowerCase()
  const dot = n.lastIndexOf('.')
  return dot === -1 ? '' : n.slice(dot)
}

export default function AnalyzePage() {
  const navigate = useNavigate()
  const { saveAnalysis } = useAnalysis()

  const [mode, setMode] = useState('paste') // 'paste' | 'upload'
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [warnings, setWarnings] = useState([])
  const [fileNotice, setFileNotice] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)

  const [phase, setPhase] = useState('edit') // 'edit' | 'working' | 'error'
  const [stage, setStage] = useState('validating')
  const [analysisError, setAnalysisError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const runIdRef = useRef(0)

  const stats = useMemo(
    () => (text.trim() ? { char_count: text.length, word_count: countWords(text) } : null),
    [text],
  )

  const tooLong = text.length > LIMITS.maxTextChars
  const tooShort = text.trim().length > 0 && text.trim().length < LIMITS.minTextChars
  const empty = text.trim().length === 0
  const canAnalyze = !empty && !tooLong && !tooShort && phase !== 'working'

  function resetDocument() {
    setName('')
    setText('')
    setWarnings([])
    setFileNotice(null)
    setExtractError(null)
    setPhase('edit')
    setAnalysisError(null)
  }

  function loadSample() {
    setName(SAMPLE_DOCUMENT.name)
    setText(SAMPLE_DOCUMENT.text)
    setWarnings([])
    setFileNotice(null)
    setExtractError(null)
    setPhase('edit')
    setAnalysisError(null)
    setMode('paste')
  }

  async function handleFile(file) {
    setExtractError(null)
    setFileNotice(null)

    const ext = extensionOf(file.name)
    if (PLANNED_FORMATS[ext]) {
      setExtractError(new Error(PLANNED_FORMATS[ext]))
      return
    }
    if (ext && !['.txt', '.text', '.md', '.markdown'].includes(ext)) {
      setExtractError(new Error('Unsupported file type. Upload a .txt file or paste the text directly.'))
      return
    }
    if (file.size > LIMITS.maxFileBytes) {
      setExtractError(new Error(`That file is ${Math.round(file.size / 1024)} KB — the limit is 512 KB.`))
      return
    }

    setExtracting(true)
    try {
      const result = await extractDocument(file)
      setName(result.name)
      setText(result.text)
      setWarnings(result.warnings || [])
      setFileNotice(`Loaded “${result.name}” — ${result.stats.word_count.toLocaleString()} words.`)
      setMode('paste') // show the extracted text in the editor, ready to review
    } catch (err) {
      setExtractError(err)
    } finally {
      setExtracting(false)
    }
  }

  async function runAnalysis() {
    if (!canAnalyze) return
    setSubmitting(true)
    setPhase('working')
    setAnalysisError(null)
    setStage('validating')
    const runId = ++runIdRef.current

    try {
      const validated = await validateDocument(text, name || 'Pasted document')
      if (runId !== runIdRef.current) return

      const { analysis, meta } = await analyzeLegalDocument({
        text: validated.text,
        name: validated.name,
        onStage: (s) => runId === runIdRef.current && setStage(s),
      })
      if (runId !== runIdRef.current) return

      saveAnalysis({
        analysis,
        meta,
        source: { name: validated.name, text: validated.text, stats: validated.stats, warnings: validated.warnings },
      })
      navigate('/results')
    } catch (err) {
      if (runId !== runIdRef.current) return
      setAnalysisError(err)
      setPhase('error')
    } finally {
      if (runId === runIdRef.current) setSubmitting(false)
    }
  }

  const tabButton = (id, label, Icon) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      aria-pressed={mode === id}
      className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors ${
        mode === id ? 'bg-ink-900 text-paper' : 'text-ink-600 hover:bg-paper-deep'
      }`}
    >
      <Icon size={14} aria-hidden /> {label}
    </button>
  )

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="overline-label">Document analysis</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">
          Add a legal document
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-600">
          Paste the text of an agreement, or upload a .txt file. LexScope analyzes it in your
          browser with Gemini and never stores a copy.
        </p>
      </div>

      {phase === 'working' ? (
        <div className="mt-8">
          <AnalysisProgress stage={stage} />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {phase === 'error' && analysisError && (
            <ErrorCard
              error={analysisError}
              onRetry={runAnalysis}
              onDismiss={() => setPhase('edit')}
            />
          )}

          <div className="card p-5 sm:p-6">
            {/* Mode tabs */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg border border-rule bg-paper p-1">
                {tabButton('paste', 'Paste text', PenLine)}
                {tabButton('upload', 'Upload file', UploadCloud)}
              </div>
              <button
                type="button"
                onClick={loadSample}
                className="hidden items-center gap-1.5 text-[13px] font-medium text-laurel-800 hover:text-laurel-900 sm:flex"
              >
                <Sparkles size={13} aria-hidden /> Load sample agreement
              </button>
            </div>

            {fileNotice && (
              <p className="mt-4 rounded-md border border-laurel-200 bg-laurel-50 px-3.5 py-2.5 text-[13px] text-laurel-900" role="status">
                {fileNotice}
              </p>
            )}

            {mode === 'upload' ? (
              <div className="mt-5">
                <FileDrop onFile={handleFile} busy={extracting} error={extractError} />
                <p className="mt-3 text-xs leading-5 text-ink-500">
                  Extracted text is loaded into the editor below so you can review or trim it
                  before analyzing.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="doc-name" className="overline-label">
                    Document name <span className="normal-case tracking-normal text-ink-400">(optional)</span>
                  </label>
                  <input
                    id="doc-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Apartment lease — March 2026"
                    className="mt-2 w-full rounded-md border border-rule-strong bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-laurel-700 focus:outline-none focus:ring-2 focus:ring-laurel-100"
                  />
                </div>

                <div>
                  <label htmlFor="doc-text" className="flex items-center justify-between">
                    <span className="overline-label">Document text</span>
                    <span className={`text-xs tabular-nums ${tooLong ? 'font-semibold text-attention-high' : 'text-ink-400'}`}>
                      {text.length.toLocaleString()} / {LIMITS.maxTextChars.toLocaleString()}
                    </span>
                  </label>
                  <textarea
                    id="doc-text"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value)
                      setWarnings([])
                      setFileNotice(null)
                    }}
                    rows={14}
                    placeholder={'Paste the full text of your document here…\n\nTip: include every clause — summaries, annexes and signature blocks often matter.'}
                    className="mt-2 w-full resize-y rounded-md border border-rule-strong bg-white px-3.5 py-3 font-display text-[13.5px] leading-6 text-ink-900 placeholder:text-ink-300 focus:border-laurel-700 focus:outline-none focus:ring-2 focus:ring-laurel-100"
                    spellCheck={false}
                  />
                </div>

                <button
                  type="button"
                  onClick={loadSample}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-laurel-800 hover:text-laurel-900 sm:hidden"
                >
                  <Sparkles size={13} aria-hidden /> Load sample agreement
                </button>
              </div>
            )}
          </div>

          {empty && (
            <p className="text-[13px] text-ink-500">
              Add text above, or load the sample agreement to see how an analysis looks.
            </p>
          )}
          {tooShort && !empty && (
            <p className="text-[13px] font-medium text-attention-medium" role="alert">
              This text looks too short to be a full document ({text.trim().length} characters —
              at least {LIMITS.minTextChars} needed).
            </p>
          )}
          {tooLong && (
            <p className="text-[13px] font-medium text-attention-high" role="alert">
              This document is over the {LIMITS.maxTextChars.toLocaleString()}-character limit.
              Split it and analyze the sections that matter most.
            </p>
          )}

          {stats && !empty && <DocMetaBar stats={stats} warnings={warnings} name={name} />}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={runAnalysis} disabled={!canAnalyze} className="btn-accent px-5 py-3 text-[15px]">
              <FileText size={16} aria-hidden />
              {submitting ? 'Analyzing…' : 'Analyze document'}
            </button>
            <button type="button" onClick={resetDocument} className="btn-ghost" disabled={empty && !name && warnings.length === 0}>
              <Eraser size={14} aria-hidden /> Clear
            </button>
          </div>

          <p className="max-w-2xl text-xs leading-5 text-ink-500">
            Your document is sent over HTTPS to the LexScope API, which relays it to Google’s
            Gemini for analysis. Nothing is stored or logged along the way, and no account is
            needed. Avoid including highly sensitive information (names, account numbers,
            national IDs) unless you’re comfortable sharing it with the AI provider.
          </p>
        </div>
      )}
    </div>
  )
}
