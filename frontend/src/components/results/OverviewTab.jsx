import { CalendarClock, ClipboardCheck, ListChecks } from 'lucide-react'
import { riskStyle } from '../ui/RiskBadge'
import { riskCounts } from '../../utils/analysisSchema.js'

function SummaryCard({ summary }) {
  const paragraphs = summary.split(/\n{2,}/).filter(Boolean)
  return (
    <div className="card p-6 sm:p-7">
      <p className="overline-label">Summary</p>
      <div className="mt-4 space-y-4">
        {paragraphs.length === 0 ? (
          <p className="text-sm italic text-ink-400">No summary was generated.</p>
        ) : (
          paragraphs.map((p, i) => (
            <p key={i} className={`leading-7 text-ink-800 ${i === 0 ? 'font-display text-[16px]' : 'text-[14px]'}`}>
              {p}
            </p>
          ))
        )}
      </div>
    </div>
  )
}

function TakeawaysCard({ takeaways }) {
  return (
    <div className="card p-6 sm:p-7">
      <p className="overline-label">Key takeaways</p>
      {takeaways.length === 0 ? (
        <p className="mt-4 text-sm italic text-ink-400">No takeaways were generated.</p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {takeaways.map((t, i) => (
            <li key={i} className="flex gap-3.5">
              <span className="font-display text-sm font-semibold tabular-nums text-laurel-700">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[13.5px] leading-6 text-ink-800">{t}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function RiskOverviewCard({ analysis, onGoToClauses }) {
  const { clauses, redFlags } = riskCounts(analysis)
  const levels = [
    { id: 'high', label: 'High attention' },
    { id: 'medium', label: 'Medium attention' },
    { id: 'low', label: 'Low attention' },
  ]
  const max = Math.max(1, ...levels.map((l) => clauses[l.id]))

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <p className="overline-label">Risk overview</p>
        <button
          type="button"
          onClick={onGoToClauses}
          className="text-[12.5px] font-medium text-laurel-800 hover:text-laurel-900"
        >
          Explore clauses →
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {levels.map(({ id, label }) => {
          const s = riskStyle(id)
          return (
            <div key={id}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-ink-800">{label}</span>
                <span className="tabular-nums text-ink-600">
                  {clauses[id]} clause{clauses[id] === 1 ? '' : 's'}
                  {redFlags[id] > 0 && (
                    <span className="text-ink-400"> · {redFlags[id]} flag{redFlags[id] === 1 ? '' : 's'}</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-deep">
                <div
                  className={`h-full rounded-full ${s.dot}`}
                  style={{ width: `${(clauses[id] / max) * 100}%`, minWidth: clauses[id] ? '6px' : 0 }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-5 border-t border-rule pt-4 text-xs leading-5 text-ink-500">
        These are AI-generated attention indicators showing where to read closely — not legal
        judgments about the document.
      </p>
    </div>
  )
}

function ObligationsCard({ obligations }) {
  if (!obligations.length) return null
  return (
    <div className="card p-6 sm:p-7">
      <p className="flex items-center gap-2 overline-label">
        <ClipboardCheck size={14} aria-hidden /> Obligations at a glance
      </p>
      <ul className="mt-4 space-y-3">
        {obligations.map((o, i) => (
          <li key={i} className="flex gap-3 text-[13.5px] leading-6 text-ink-700">
            <ListChecks size={15} className="mt-1 shrink-0 text-laurel-700" aria-hidden />
            <span>{o}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DatesCard({ dates }) {
  if (!dates.length) return null
  return (
    <div className="card p-6 sm:p-7">
      <p className="flex items-center gap-2 overline-label">
        <CalendarClock size={14} aria-hidden /> Important dates
      </p>
      <ul className="mt-4 space-y-3.5">
        {dates.map((d, i) => (
          <li key={i} className="flex flex-col gap-0.5 border-l-2 border-rule pl-4">
            <span className="font-display text-[15px] font-semibold text-ink-950">{d.date}</span>
            {d.description && <span className="text-[13px] leading-5 text-ink-600">{d.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function OverviewTab({ analysis, onGoToClauses }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SummaryCard summary={analysis.summary} />
        <TakeawaysCard takeaways={analysis.key_takeaways} />
        <ObligationsCard obligations={analysis.obligations} />
      </div>
      <div className="space-y-5">
        <RiskOverviewCard analysis={analysis} onGoToClauses={onGoToClauses} />
        <DatesCard dates={analysis.important_dates} />
      </div>
    </div>
  )
}
