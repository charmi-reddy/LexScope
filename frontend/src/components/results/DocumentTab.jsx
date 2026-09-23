import { useMemo, useState } from 'react'
import { LocateFixed, MousePointerClick } from 'lucide-react'
import { locateClauses } from '../../utils/highlight.js'
import RiskBadge, { riskStyle } from '../ui/RiskBadge'
import { categoryLabel } from '../../utils/analysisSchema.js'

const HL_CLASS = {
  high: 'bg-attention-high-bg text-attention-high decoration-attention-high-border',
  medium: 'bg-attention-medium-bg text-attention-medium decoration-attention-medium-border',
  low: 'bg-attention-low-bg text-attention-low decoration-attention-low-border',
}

export default function DocumentTab({ docText, clauses }) {
  const { highlights, located } = useMemo(() => locateClauses(docText, clauses), [docText, clauses])
  const [selectedId, setSelectedId] = useState(null)

  const clauseById = useMemo(() => Object.fromEntries(clauses.map((c) => [c.id, c])), [clauses])
  const selected = selectedId ? clauseById[selectedId] : null
  const selectedHighlight = selectedId ? highlights.find((h) => h.id === selectedId) : null

  const segments = useMemo(() => {
    const segs = []
    let cursor = 0
    for (const h of highlights) {
      if (h.start < cursor) continue // safety; locateClauses already de-overlaps
      if (h.start > cursor) segs.push({ key: `t${cursor}`, text: docText.slice(cursor, h.start) })
      segs.push({ key: h.id, text: docText.slice(h.start, h.end), highlight: h })
      cursor = h.end
    }
    if (cursor < docText.length) segs.push({ key: `t${cursor}`, text: docText.slice(cursor) })
    return segs
  }, [docText, highlights])

  const locatedClauses = highlights
    .map((h) => ({ h, clause: clauseById[h.id] }))
    .filter((x) => x.clause)

  return (
    <div>
      {/* Legend + status */}
      <div className="card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500">Legend</span>
          <span className="chip bg-attention-high-bg text-attention-high border-attention-high-border">High attention</span>
          <span className="chip bg-attention-medium-bg text-attention-medium border-attention-medium-border">Medium</span>
          <span className="chip bg-attention-low-bg text-attention-low border-attention-low-border">Low</span>
        </div>
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
          <LocateFixed size={13} aria-hidden />
          {located} of {clauses.length} clauses located in the document text
        </span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        {/* Document viewer */}
        {docText ? (
          <div className="card overflow-hidden">
            <div className="border-b border-rule bg-paper/70 px-5 py-3">
              <p className="overline-label">Original document</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-7">
            <p className="prose-legal whitespace-pre-wrap">
              {segments.map((seg) =>
                seg.highlight ? (
                  <span
                    key={seg.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(seg.highlight.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedId(seg.highlight.id)
                      }
                    }}
                    title={`${clauseById[seg.highlight.id]?.title} — click for the plain-language explanation`}
                    className={`cursor-pointer rounded-sm px-0.5 underline decoration-2 underline-offset-2 transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ink-950 ${
                      HL_CLASS[seg.highlight.riskLevel]
                    } ${selectedId === seg.highlight.id ? 'ring-2 ring-ink-950' : ''}`}
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={seg.key}>{seg.text}</span>
                ),
              )}
            </p>
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center">
            <p className="text-sm text-ink-500">
              The original text isn’t available in this session — run the analysis again from the
              document editor to see highlights.
            </p>
          </div>
        )}

        {/* Explanation side panel */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          {selected ? (
            <div className="card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="overline-label">Selected clause</p>
                <button type="button" onClick={() => setSelectedId(null)} className="text-xs text-ink-400 hover:text-ink-700">
                  Clear
                </button>
              </div>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink-950">{selected.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RiskBadge level={selected.risk_level} short />
                <span className="chip border-rule bg-paper text-ink-500">{categoryLabel(selected.category)}</span>
                {selectedHighlight?.match === 'fuzzy' && (
                  <span className="text-[11px] italic text-ink-400">matched approximately</span>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="overline-label">In plain language</p>
                  <p className="mt-1.5 text-[13.5px] leading-6 text-ink-800">{selected.plain_language || '—'}</p>
                </div>
                <div>
                  <p className="overline-label">Why it matters</p>
                  <p className="mt-1.5 text-[13px] leading-6 text-ink-700">{selected.why_it_matters || '—'}</p>
                </div>
                {selected.suggested_action && (
                  <div className="rounded-md border border-rule bg-paper px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-laurel-800">Worth checking</p>
                    <p className="mt-1 text-[12.5px] leading-5 text-ink-800">{selected.suggested_action}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-5 sm:p-6">
              <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink-800">
                <MousePointerClick size={15} className="text-laurel-700" aria-hidden />
                Select a highlighted passage
              </p>
              <p className="mt-2 text-[13px] leading-6 text-ink-500">
                Highlighted parts of the document were flagged by the AI. Click any of them to see
                the plain-language explanation here.
              </p>
            </div>
          )}

          {/* Quick navigation */}
          {locatedClauses.length > 0 && (
            <div className="card mt-4 p-5">
              <p className="overline-label">Jump to a clause</p>
              <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                {locatedClauses.map(({ h, clause }) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(h.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                        selectedId === h.id ? 'bg-paper-deep text-ink-950' : 'text-ink-600 hover:bg-paper'
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${riskStyle(clause.risk_level).dot}`} aria-hidden />
                      <span className="truncate">{clause.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
