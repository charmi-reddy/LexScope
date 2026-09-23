import { useMemo, useState } from 'react'
import { ChevronDown, Quote } from 'lucide-react'
import RiskBadge, { riskStyle } from '../ui/RiskBadge'
import { CATEGORIES, categoryLabel } from '../../utils/analysisSchema.js'

const RISK_ORDER = { high: 0, medium: 1, low: 2 }

function ClauseCard({ clause, index, open, onToggle }) {
  const s = riskStyle(clause.risk_level)
  return (
    <article className={`card overflow-hidden transition-shadow ${open ? 'shadow-sm' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-paper/60"
      >
        <span className="mt-0.5 font-display text-sm font-semibold tabular-nums text-ink-300">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block flex-wrap items-center gap-2 text-left sm:flex">
            <span className="text-[15px] font-semibold text-ink-950">{clause.title}</span>
            <span className="chip border-rule bg-paper text-ink-500">{categoryLabel(clause.category)}</span>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <RiskBadge level={clause.risk_level} short withIcon={false} />
            <span className="text-xs text-ink-400">
              {clause.plain_language ? clause.plain_language.slice(0, 90) + (clause.plain_language.length > 90 ? '…' : '') : ''}
            </span>
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`mt-1 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-rule px-5 py-5 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="overline-label">In the document</p>
              {clause.original_text ? (
                <blockquote className={`prose-legal mt-3 rounded-md border-l-4 px-4 py-3.5 ${s.cls}`}>
                  <Quote size={13} className="mb-1.5 opacity-60" aria-hidden />
                  {clause.original_text}
                </blockquote>
              ) : (
                <p className="mt-3 text-sm italic text-ink-400">No excerpt was provided.</p>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <p className="overline-label">In plain language</p>
                <p className="mt-2 text-[14px] leading-6 text-ink-800">{clause.plain_language || '—'}</p>
              </div>
              <div>
                <p className="overline-label">Why it matters</p>
                <p className="mt-2 text-[13.5px] leading-6 text-ink-700">{clause.why_it_matters || '—'}</p>
              </div>
              {clause.suggested_action && (
                <div className="rounded-md border border-rule bg-paper px-4 py-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-laurel-800">
                    Worth checking
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-ink-800">{clause.suggested_action}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export default function ClauseExplorer({ clauses }) {
  const [riskFilter, setRiskFilter] = useState('all')
  const [category, setCategory] = useState('all')
  const [openIds, setOpenIds] = useState(() => new Set())

  const availableCategories = useMemo(() => {
    const present = new Set(clauses.map((c) => c.category))
    return CATEGORIES.filter((c) => present.has(c.id))
  }, [clauses])

  const filtered = useMemo(() => {
    const list = clauses.filter(
      (c) => (riskFilter === 'all' || c.risk_level === riskFilter) && (category === 'all' || c.category === category),
    )
    return [...list].sort((a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level])
  }, [clauses, riskFilter, category])

  const counts = useMemo(() => {
    const c = { all: clauses.length, high: 0, medium: 0, low: 0 }
    clauses.forEach((clause) => (c[clause.risk_level] += 1))
    return c
  }, [clauses])

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setOpenIds((prev) => (prev.size >= filtered.length ? new Set() : new Set(filtered.map((c) => c.id))))
  }

  const riskButton = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setRiskFilter(id)}
      aria-pressed={riskFilter === id}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
        riskFilter === id ? 'bg-ink-900 text-paper' : 'text-ink-600 hover:bg-paper-deep'
      }`}
    >
      {label}
      {id !== 'all' && <span className="ml-1.5 tabular-nums opacity-70">{counts[id]}</span>}
    </button>
  )

  return (
    <div>
      {/* Filters */}
      <div className="card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-rule bg-paper p-1" role="group" aria-label="Filter by attention level">
          {riskButton('all', `All (${counts.all})`)}
          {riskButton('high', 'High')}
          {riskButton('medium', 'Medium')}
          {riskButton('low', 'Low')}
        </div>

        <div className="flex items-center gap-3">
          {availableCategories.length > 1 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by clause category"
              className="rounded-md border border-rule-strong bg-white px-3 py-2 text-[13px] text-ink-800 focus:border-laurel-700 focus:outline-none focus:ring-2 focus:ring-laurel-100"
            >
              <option value="all">All categories</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={toggleAll} className="text-[12.5px] font-medium text-laurel-800 hover:text-laurel-900">
            {openIds.size >= filtered.length && filtered.length > 0 ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-ink-500">No clauses match this filter.</p>
            <button
              type="button"
              onClick={() => {
                setRiskFilter('all')
                setCategory('all')
              }}
              className="mt-3 text-[13px] font-medium text-laurel-800 hover:text-laurel-900"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filtered.map((clause, i) => (
            <ClauseCard
              key={clause.id}
              clause={clause}
              index={i}
              open={openIds.has(clause.id)}
              onToggle={() => toggle(clause.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
