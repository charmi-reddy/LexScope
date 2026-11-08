import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import ResultsHeader from '../components/results/ResultsHeader'
import OverviewTab from '../components/results/OverviewTab'
import ClauseExplorer from '../components/results/ClauseExplorer'
import DocumentTab from '../components/results/DocumentTab'
import RedFlagsTab from '../components/results/RedFlagsTab'
import QuestionsTab from '../components/results/QuestionsTab'
import DisclaimerNote from '../components/ui/DisclaimerNote'
import { useAnalysis } from '../context/AnalysisContext'
import { normalizeAnalysis } from '../utils/analysisSchema'
import { locateQuote } from '../utils/highlight.js'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'clauses', label: 'Clauses' },
  { id: 'document', label: 'Document' },
  { id: 'flags', label: 'Red flags' },
  { id: 'questions', label: 'Questions' },
]

export default function ResultsPage() {
  const { result } = useAnalysis()
  const [params, setParams] = useSearchParams()
  const [selectedSpan, setSelectedSpan] = useState(null)
  const tab = params.get('tab') || 'overview'

  // Re-normalize on read so even a persisted older shape renders safely.
  const { analysis } = useMemo(
    () => normalizeAnalysis(result?.analysis || {}),
    [result],
  )

  if (!result) return <Navigate to="/analyze" replace />

  const source = result.source || {}
  const docText = source.text || ''
  const counts = {
    clauses: analysis.clauses.length,
    flags: analysis.red_flags.length,
    questions: analysis.questions_to_ask.length,
  }
  const citationStats = useMemo(() => {
    const items = [
      ...analysis.clauses.map((c) => ({ quote: c.original_text || '', kind: 'clause' })),
      ...analysis.red_flags.map((f) => ({ quote: f.supporting_quote || '', kind: 'flag' })),
    ].filter((item) => item.quote.trim())

    let verified = 0
    let notFound = 0

    for (const item of items) {
      const status = locateQuote(docText, item.quote).status
      if (status === 'exact' || status === 'approximate') verified += 1
      else if (status === 'not_found') notFound += 1
    }

    return {
      total: items.length,
      verified,
      notFound,
    }
  }, [analysis, docText])

  const labelWithCount = (id) => {
    const t = TABS.find((x) => x.id === id)
    const n = { clauses: counts.clauses, flags: counts.flags, questions: counts.questions }[id]
    return n != null ? `${t.label} (${n})` : t.label
  }

  function setTab(id) {
    setParams(id === 'overview' ? {} : { tab: id }, { replace: true })
  }

  return (
    <div>
      <ResultsHeader analysis={analysis} source={source} meta={result.meta} citationStats={citationStats} />

      {/* Sticky tabs */}
      <nav
        className="sticky top-16 z-30 border-b border-rule bg-paper/95 backdrop-blur no-print"
        aria-label="Report sections"
      >
        <div className="container-page flex gap-1 overflow-x-auto py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors ${
                tab === t.id ? 'bg-ink-900 text-paper' : 'text-ink-600 hover:bg-paper-deep'
              }`}
            >
              {labelWithCount(t.id)}
            </button>
          ))}
        </div>
      </nav>

      <div className="container-page py-8">
        {tab === 'overview' && <OverviewTab analysis={analysis} onGoToClauses={() => setTab('clauses')} />}
        {tab === 'clauses' && <ClauseExplorer clauses={analysis.clauses} docText={docText} />}
        {tab === 'document' && (
          <DocumentTab
            docText={docText}
            clauses={analysis.clauses}
            selectedSpan={selectedSpan}
            onSelectSpan={setSelectedSpan}
          />
        )}
        {tab === 'flags' && (
          <RedFlagsTab
            redFlags={analysis.red_flags}
            docText={docText}
            onShowInDocument={(span) => {
              setSelectedSpan(span)
              setTab('document')
            }}
          />
        )}
        {tab === 'questions' && <QuestionsTab questions={analysis.questions_to_ask} />}

        <div className="mt-8 max-w-2xl">
          <DisclaimerNote variant="card" />
        </div>
      </div>
    </div>
  )
}
