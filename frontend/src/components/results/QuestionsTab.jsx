import { useState } from 'react'
import { Check, Copy, MessageCircleQuestion } from 'lucide-react'

export default function QuestionsTab({ questions }) {
  const [checked, setChecked] = useState(() => new Set())
  const [copied, setCopied] = useState(false)

  function toggle(i) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function copyAll() {
    const text = questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for blocked clipboard APIs
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!questions.length) {
    return (
      <div className="card p-10 text-center">
        <MessageCircleQuestion size={22} className="mx-auto text-ink-300" aria-hidden />
        <p className="mt-3 text-sm text-ink-500">No questions were generated for this document.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-rule bg-paper/70 px-5 py-3.5 sm:px-6">
        <p className="overline-label">Before you sign, consider asking</p>
        <button type="button" onClick={copyAll} className="flex items-center gap-1.5 text-[12.5px] font-medium text-laurel-800 hover:text-laurel-900">
          <Copy size={13} aria-hidden /> {copied ? 'Copied!' : 'Copy all'}
        </button>
      </div>

      <ul className="divide-y divide-rule">
        {questions.map((q, i) => {
          const done = checked.has(i)
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={done}
                className="flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-paper/60 sm:px-6"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    done ? 'border-laurel-700 bg-laurel-700' : 'border-rule-strong bg-white'
                  }`}
                  aria-hidden
                >
                  {done && <Check size={13} className="text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  <span className={`block text-[14px] leading-6 ${done ? 'text-ink-400 line-through' : 'text-ink-900'}`}>
                    {q}
                  </span>
                </span>
                <span className="mt-0.5 font-display text-sm font-semibold tabular-nums text-ink-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="border-t border-rule bg-paper/50 px-5 py-3.5 text-xs leading-5 text-ink-500 sm:px-6">
        These questions are generated for discussion and review — they are not legal advice, and
        the “right” answer depends on your situation.
      </p>
    </div>
  )
}
