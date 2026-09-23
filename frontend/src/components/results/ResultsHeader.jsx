import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Printer } from 'lucide-react'
import RiskBadge from '../ui/RiskBadge'
import { formatNumber } from '../../utils/text.js'

export default function ResultsHeader({ analysis, source, meta }) {
  const navigate = useNavigate()
  const stats = source?.stats

  return (
    <section className="bg-ink-950 text-paper">
      <div className="container-page py-10 sm:py-12">
        <p className="overline-label text-ink-400!">Analysis report</p>

        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight sm:text-[32px]" title={source?.name}>
              {source?.name || 'Unnamed document'}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip border-paper/25 text-ink-200">
                <FileText size={13} aria-hidden /> {analysis.document_type}
              </span>
              <RiskBadge level={analysis.overall_risk} />
              {stats && (
                <span className="text-xs text-ink-400">
                  {formatNumber(stats.word_count)} words · ~{stats.reading_time_minutes} min read
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <button type="button" onClick={() => window.print()} className="btn-light py-2! text-[13px]">
              <Printer size={14} aria-hidden /> Print report
            </button>
            <button type="button" onClick={() => navigate('/analyze')} className="btn-accent py-2! text-[13px]">
              <Plus size={14} aria-hidden /> New analysis
            </button>
          </div>
        </div>

        <p className="mt-6 border-t border-ink-800 pt-4 text-[11.5px] text-ink-500">
          {meta?.model && (
            <>
              Analyzed with <span className="text-ink-300">{meta.model}</span> via Puter ·{' '}
            </>
          )}
          {meta?.durationMs != null && <>completed in {(meta.durationMs / 1000).toFixed(0)}s · </>}
          AI-generated attention indicators — not legal judgments.
        </p>
      </div>
    </section>
  )
}
