import { locateQuote } from './highlight.js'

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

function firstSentence(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return ''

  const match = trimmed.match(/^[^.!?]+[.!?]?/)
  return (match?.[0] || trimmed).trim()
}

export function pickTopFindings(analysis, docText, max = 3) {
  const redFlags = Array.isArray(analysis?.red_flags) ? analysis.red_flags : []
  if (!redFlags.length) return []

  const sorted = redFlags
    .map((flag, index) => ({ flag, index }))
    .sort((a, b) => {
      const aRank = SEVERITY_ORDER[a.flag.severity] ?? 99
      const bRank = SEVERITY_ORDER[b.flag.severity] ?? 99
      return aRank - bRank || a.index - b.index
    })
    .slice(0, Math.max(0, max))

  return sorted.map(({ flag }) => {
    const title = String(flag.title || '').trim()
    const explanation = String(flag.explanation || '').trim()
    const line = title || firstSentence(explanation)

    const quote = String(flag.supporting_quote || '').trim()
    let span = null
    if (quote) {
      const located = locateQuote(docText || '', quote)
      if (located.status === 'exact' || located.status === 'approximate') {
        span = { start: located.start, end: located.end, id: flag.id }
      }
    }

    return {
      id: flag.id,
      title,
      line,
      severity: flag.severity,
      span,
    }
  })
}
