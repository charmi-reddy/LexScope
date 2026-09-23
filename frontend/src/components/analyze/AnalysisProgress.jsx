import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

const STEPS = [
  { key: 'validating', label: 'Validating document' },
  { key: 'connect', label: 'Connecting to Gemini' },
  { key: 'analyzing', label: 'Reading the document & identifying clauses' },
  { key: 'parsing', label: 'Compiling your report' },
]

function elapsedLabel(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function AnalysisProgress({ stage }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.key === stage))

  return (
    <div className="card p-6 sm:p-8" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="overline-label">Analyzing</p>
        <span className="font-mono text-xs tabular-nums text-ink-500">{elapsedLabel(seconds)}</span>
      </div>

      <h2 className="mt-3 font-display text-xl font-semibold text-ink-950">
        Reading your document…
      </h2>
      <p className="mt-1 text-[13.5px] text-ink-500">
        Gemini is going through it clause by clause. This typically takes 15–60 seconds.
      </p>

      <ol className="mt-6 space-y-1">
        {STEPS.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <li key={step.key} className="flex items-center gap-3 rounded-md px-2 py-2">
              {done ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-laurel-700">
                  <Check size={12} className="text-white" strokeWidth={3} aria-hidden />
                </span>
              ) : active ? (
                <Loader2 size={18} className="animate-spin text-laurel-700" aria-hidden />
              ) : (
                <span className="h-[18px] w-[18px] rounded-full border-2 border-rule" aria-hidden />
              )}
              <span className={`text-[13.5px] ${done ? 'text-ink-500' : active ? 'font-medium text-ink-950' : 'text-ink-400'}`}>
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-5 overflow-hidden rounded-full bg-paper-deep">
        <div
          className="h-1 rounded-full bg-laurel-700 transition-all duration-700"
          style={{ width: `${Math.min(100, ((currentIndex + 1) / STEPS.length) * 100)}%` }}
        />
      </div>
    </div>
  )
}
