import { FlagTriangleRight, ShieldCheck } from 'lucide-react'
import RiskBadge, { riskStyle } from '../ui/RiskBadge'

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

export default function RedFlagsTab({ redFlags }) {
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
            </div>
          </article>
        )
      })}
    </div>
  )
}
