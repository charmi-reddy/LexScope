import RiskBadge, { riskStyle } from '../ui/RiskBadge'

export default function TopFindings({ findings, onShowInDocument }) {
  if (!findings?.length) return null

  const count = findings.length
  const heading = `${count} ${count === 1 ? 'thing' : 'things'} to look at before you sign`

  return (
    <section className="card p-6 sm:p-7">
      <p className="overline-label">Top findings</p>
      <h2 className="mt-2 font-display text-xl font-semibold text-ink-950">{heading}</h2>
      <p className="mt-1.5 text-[13px] text-ink-600">
        Based on the AI&apos;s red flags. Tap one to see the exact sentence in your document.
      </p>

      <ol className="mt-5 space-y-2.5">
        {findings.map((finding, index) => {
          const style = riskStyle(finding.severity)
          const hasSpan = !!finding.span

          if (hasSpan) {
            return (
              <li key={finding.id}>
                <button
                  type="button"
                  onClick={() => onShowInDocument?.(finding.span)}
                  className="flex w-full items-start gap-3 rounded-md border border-rule bg-paper px-3.5 py-3 text-left transition-colors hover:bg-paper-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950"
                >
                  <span className={`chip ${style.cls} min-w-7 justify-center px-2 py-0.5 tabular-nums`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] leading-6 text-ink-900">{finding.line || 'Untitled finding'}</span>
                    <span className="mt-1 inline-flex items-center gap-2">
                      <RiskBadge level={finding.severity} short />
                      <span className="text-[11.5px] font-medium text-laurel-800">See in document</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          }

          return (
            <li
              key={finding.id}
              className="flex items-start gap-3 rounded-md border border-rule bg-paper px-3.5 py-3"
            >
              <span className={`chip ${style.cls} min-w-7 justify-center px-2 py-0.5 tabular-nums`}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] leading-6 text-ink-900">{finding.line || 'Untitled finding'}</span>
                <span className="mt-1 inline-flex items-center gap-2">
                  <RiskBadge level={finding.severity} short />
                  <span className="text-[11.5px] text-ink-500">No matching quote found in the document</span>
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
