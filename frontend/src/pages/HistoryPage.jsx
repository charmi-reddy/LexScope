import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import RiskBadge from '../components/ui/RiskBadge'
import { useAnalysis } from '../context/AnalysisContext'
import { loadHistory, removeFromHistory } from '../utils/historyStorage.js'

export default function HistoryPage() {
  const navigate = useNavigate()
  const { saveAnalysis } = useAnalysis()
  const [entries, setEntries] = useState(() => loadHistory())

  function openEntry(entry) {
    saveAnalysis(
      {
        analysis: entry.analysis,
        meta: entry.meta,
        source: entry.source,
      },
      { addToHistory: false },
    )
    navigate('/results')
  }

  function deleteEntry(id) {
    setEntries(removeFromHistory(id))
  }

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="overline-label">History</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-4xl">Past analyses</h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-600">
          Saved on this device only - never sent to our servers. Deleting here or clearing your browser data removes them for good.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="card mt-8 p-6">
          <p className="font-display text-xl font-semibold text-ink-950">No past analyses yet.</p>
          <p className="mt-2 text-sm text-ink-500">Analyze a document and the report will show up here.</p>
          <Link to="/analyze" className="btn-accent mt-5 inline-flex">
            Analyze a document
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3.5">
          {entries.map((entry) => {
            const name = entry?.source?.name || 'Unnamed document'
            const createdAt = entry?.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown date'
            const docType = entry?.analysis?.document_type
            const risk = entry?.analysis?.overall_risk

            return (
              <article key={entry.id} className="card flex items-start justify-between gap-4 p-5 sm:p-6">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-[18px] font-semibold text-ink-950" title={name}>
                    {name}
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">{createdAt}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {docType && <span className="chip border-rule bg-paper text-ink-600">{docType}</span>}
                    {risk && <RiskBadge level={risk} short />}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => openEntry(entry)} className="btn-ghost">
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    aria-label="Delete analysis"
                    className="rounded-md border border-rule px-2.5 py-2 text-ink-500 transition-colors hover:bg-paper-deep hover:text-attention-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-950"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
