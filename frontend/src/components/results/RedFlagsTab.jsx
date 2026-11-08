import { FlagTriangleRight, ShieldCheck } from 'lucide-react'
import RiskBadge, { riskStyle } from '../ui/RiskBadge'
import { locateQuote } from '../../utils/highlight.js'

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

export default function RedFlagsTab({ redFlags, docText, onShowInDocument }) {
  if (!redFlags.length) {
    return (
      <div className="card flex items-start gap-4 p-8">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-attention-low-border bg-attention-low-bg">
          <ShieldCheck size={20} className="text-attention-low" aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-950">No red flags identified</h3>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-6 text-ink-600">
            The AI didn’t find provisions that stand out as unusual or one-sided in this document.
            Still review the clause explorer — attention indicators there show what to read
            closely, and “no flags” is not a guarantee.
          </p>
        </div>
      </div>
    )
  }

  const sorted = [...redFlags].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return (
    <div className="space-y-4">
      <div className="card flex items-start gap-3 border-attention-medium-border bg-attention-medium-bg/60 px-5 py-4">
        <FlagTriangleRight size={17} className="mt-0.5 shrink-0 text-attention-medium" aria-hidden />
        <p className="text-[13px] leading-6 text-ink-800">
          <span className="font-semibold">Read the explanations.</span> A flagged provision isn’t
          automatically a problem — many standard clauses deserve attention without being
          unfavorable. The AI explains why each specific <em>wording</em> stands out.
        </p>
      </div>

      {sorted.map((flag) => {
        const s = riskStyle(flag.severity)
        const quoteText = (flag.supporting_quote || '').trim()
        const quoteStatus = quoteText && docText ? locateQuote(docText, quoteText) : { status: 'none', start: null, end: null }
        const quoteChip = {
          exact: 'Verified in document',
          approximate: 'Matched approximately',
          not_found: 'Quote not found',
        }[quoteStatus.status]
        const quoteChipClass = {
          exact: 'border-laurel-200 bg-laurel-50 text-laurel-800',
          approximate: 'border-attention-medium-border bg-attention-medium-bg text-attention-medium',
          not_found: 'border-attention-medium-border bg-attention-medium-bg text-attention-high',
        }[quoteStatus.status] || ''

        return (
          <article key={flag.id} className="card overflow-hidden">
            <div className={`border-b border-l-4 px-5 py-3.5 ${s.cls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                  <FlagTriangleRight size={15} aria-hidden /> {flag.title}
                </h3>
                <RiskBadge level={flag.severity} short />
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13.5px] leading-6 text-ink-800">{flag.explanation}</p>
              {flag.related_clause && (
                <p className="mt-3 text-[12.5px] text-ink-500">
                  Related clause: <span className="font-medium text-ink-700">{flag.related_clause}</span>
                </p>
              )}

              {quoteText ? (
                <div className="mt-4 rounded-md border border-rule bg-paper px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="overline-label">Supporting quote</p>
                    {quoteStatus.status !== 'none' && quoteChip && (
                      <span className={`chip ${quoteChipClass}`}>{quoteChip}</span>
                    )}
                  </div>
                  <blockquote className="prose-legal mt-2 rounded-md border-l-4 border-rule bg-white px-3 py-2.5 text-[13.5px] text-ink-700">
                    {quoteText}
                  </blockquote>
                  {quoteStatus.status === 'not_found' && (
                    <p className="mt-2 text-[12px] font-medium text-attention-high">
                      Quote not found in document - treat this flag with caution.
                    </p>
                  )}
                  {(quoteStatus.status === 'exact' || quoteStatus.status === 'approximate') && onShowInDocument && (
                    <button
                      type="button"
                      onClick={() => onShowInDocument({ start: quoteStatus.start, end: quoteStatus.end, id: flag.id })}
                      className="mt-3 text-[12px] font-medium text-laurel-800 hover:text-laurel-900"
                    >
                      Show in document
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-[12.5px] text-ink-500">No quote - this flag is about something missing or the AI gave no source.</p>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
