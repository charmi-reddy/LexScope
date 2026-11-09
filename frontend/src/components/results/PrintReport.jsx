import { DISCLAIMER_TEXT } from '../ui/DisclaimerNote'
import { categoryLabel } from '../../utils/analysisSchema.js'

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

function attentionLabel(level) {
  if (level === 'high') return 'High attention'
  if (level === 'low') return 'Low attention'
  return 'Medium attention'
}

function hasText(value) {
  return String(value || '').trim().length > 0
}

export default function PrintReport({ analysis, source, meta, findings }) {
  const documentName = source?.name || 'Unnamed document'
  const stats = source?.stats

  const summaryParagraphs = String(analysis?.summary || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const takeaways = Array.isArray(analysis?.key_takeaways) ? analysis.key_takeaways.filter(hasText) : []
  const redFlags = Array.isArray(analysis?.red_flags)
    ? [...analysis.red_flags].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99))
    : []
  const clauses = Array.isArray(analysis?.clauses) ? analysis.clauses : []
  const questions = Array.isArray(analysis?.questions_to_ask) ? analysis.questions_to_ask.filter(hasText) : []
  const topFindings = Array.isArray(findings) ? findings : []

  const metaItems = []
  if (hasText(analysis?.document_type)) metaItems.push(analysis.document_type)
  if (hasText(analysis?.overall_risk)) metaItems.push(attentionLabel(analysis.overall_risk))
  if (stats?.word_count != null) metaItems.push(`${Number(stats.word_count).toLocaleString()} words`)
  if (stats?.reading_time_minutes != null) metaItems.push(`~${stats.reading_time_minutes} min read`)
  if (meta?.analyzedAt) {
    const analyzedDate = new Date(meta.analyzedAt)
    if (!Number.isNaN(analyzedDate.getTime())) {
      metaItems.push(`Analyzed ${analyzedDate.toLocaleDateString()}`)
    }
  }

  return (
    <article className="print-report">
      <header className="print-report__header">
        <p className="print-report__brand">LexScope</p>
        <h1 className="print-report__title">{documentName}</h1>
        {metaItems.length > 0 && <p className="print-report__meta">{metaItems.join(' · ')}</p>}
        <p className="print-report__notice">AI-generated attention indicators - not legal judgments.</p>
      </header>

      {topFindings.length > 0 && (
        <section className="print-report__section report-section">
          <h2>Top findings</h2>
          <ol>
            {topFindings.map((finding) => (
              <li key={finding.id}>
                <strong>{attentionLabel(finding.severity)}:</strong> {finding.line}
              </li>
            ))}
          </ol>
        </section>
      )}

      {summaryParagraphs.length > 0 && (
        <section className="print-report__section report-section">
          <h2>Summary</h2>
          {summaryParagraphs.map((paragraph, i) => (
            <p key={`summary-${i}`}>{paragraph}</p>
          ))}
        </section>
      )}

      {takeaways.length > 0 && (
        <section className="print-report__section report-section">
          <h2>Key takeaways</h2>
          <ol>
            {takeaways.map((takeaway, i) => (
              <li key={`takeaway-${i}`}>{takeaway}</li>
            ))}
          </ol>
        </section>
      )}

      {redFlags.length > 0 && (
        <section className="print-report__section report-section">
          <h2>Red flags</h2>
          {redFlags.map((flag) => (
            <article key={flag.id} className="print-report__item report-item">
              <h3>{flag.title}</h3>
              <p><strong>Severity:</strong> {attentionLabel(flag.severity)}</p>
              {hasText(flag.explanation) && <p>{flag.explanation}</p>}
              {hasText(flag.supporting_quote) && (
                <blockquote className="print-report__quote report-quote">{flag.supporting_quote}</blockquote>
              )}
              {hasText(flag.related_clause) && (
                <p><strong>Related clause:</strong> {flag.related_clause}</p>
              )}
            </article>
          ))}
        </section>
      )}

      {clauses.length > 0 && (
        <section className="print-report__section report-section">
          <h2>Clauses</h2>
          {clauses.map((clause) => (
            <article key={clause.id} className="print-report__item report-item">
              <h3>{clause.title}</h3>
              <p>
                <strong>Category:</strong> {categoryLabel(clause.category)} · <strong>Attention:</strong> {attentionLabel(clause.risk_level)}
              </p>
              {hasText(clause.plain_language) && (
                <p><strong>Plain language:</strong> {clause.plain_language}</p>
              )}
              {hasText(clause.why_it_matters) && (
                <p><strong>Why it matters:</strong> {clause.why_it_matters}</p>
              )}
              {hasText(clause.suggested_action) && (
                <p><strong>Suggested action:</strong> {clause.suggested_action}</p>
              )}
              {hasText(clause.original_text) && (
                <blockquote className="print-report__quote print-report__quote--small report-quote">{clause.original_text}</blockquote>
              )}
            </article>
          ))}
        </section>
      )}

      {questions.length > 0 && (
        <section className="print-report__section report-section">
          <h2>Questions to ask</h2>
          <ol>
            {questions.map((question, i) => (
              <li key={`question-${i}`}>{question}</li>
            ))}
          </ol>
        </section>
      )}

      <footer className="print-report__footer">
        <p>{DISCLAIMER_TEXT}</p>
        <p>Generated by LexScope (lexscope.xyz)</p>
      </footer>
    </article>
  )
}
