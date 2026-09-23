/**
 * Schema + normalisation for the AI analysis result.
 *
 * The LLM is asked for strict JSON, but we never trust it blindly: this module
 * coerces every field to the shape the UI expects, applies safe defaults, and
 * clamps enums. The UI therefore never crashes on malformed AI output.
 */

export const RISK_LEVELS = ['high', 'medium', 'low']

export const CATEGORIES = [
  { id: 'payment', label: 'Payment' },
  { id: 'termination', label: 'Termination' },
  { id: 'liability', label: 'Liability' },
  { id: 'indemnity', label: 'Indemnity' },
  { id: 'privacy', label: 'Privacy & data' },
  { id: 'confidentiality', label: 'Confidentiality' },
  { id: 'renewal', label: 'Renewal' },
  { id: 'dispute_resolution', label: 'Dispute resolution' },
  { id: 'intellectual_property', label: 'Intellectual property' },
  { id: 'other', label: 'Other' },
]

const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id))

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label || 'Other'
}

export function normalizeRisk(value, fallback = 'medium') {
  const v = String(value || '').toLowerCase().trim()
  if (RISK_LEVELS.includes(v)) return v
  if (v === 'high attention' || v === 'critical' || v === 'severe') return 'high'
  if (v === 'low attention' || v === 'none' || v === 'minor') return 'low'
  if (v === 'moderate' || v === 'medium attention') return 'medium'
  return fallback
}

const asString = (v, fallback = '') => {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return fallback
}

const asStringArray = (v, max = 12) => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        return asString(item.text || item.description || item.point || item.title)
      }
      return ''
    })
    .filter(Boolean)
    .slice(0, max)
}

function normalizeClause(raw, index) {
  const c = raw && typeof raw === 'object' ? raw : {}
  return {
    id: `clause-${index + 1}`,
    title: asString(c.title, `Clause ${index + 1}`) || `Clause ${index + 1}`,
    category: CATEGORY_IDS.has(asString(c.category)) ? asString(c.category) : 'other',
    original_text: asString(c.original_text || c.originalText),
    plain_language: asString(c.plain_language || c.plainLanguage),
    risk_level: normalizeRisk(c.risk_level ?? c.riskLevel),
    why_it_matters: asString(c.why_it_matters || c.whyItMatters),
    suggested_action: asString(c.suggested_action || c.suggestedAction),
  }
}

function normalizeRedFlag(raw, index) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    id: `flag-${index + 1}`,
    title: asString(r.title, `Flag ${index + 1}`) || `Flag ${index + 1}`,
    severity: normalizeRisk(r.severity),
    explanation: asString(r.explanation),
    related_clause: asString(r.related_clause || r.relatedClause),
  }
}

function normalizeDate(raw) {
  if (typeof raw === 'string') return { date: raw, description: '' }
  if (raw && typeof raw === 'object') {
    return {
      date: asString(raw.date || raw.when || raw.value),
      description: asString(raw.description || raw.what || raw.event || raw.label),
    }
  }
  return null
}

/**
 * Coerces a raw parsed JSON object into the full LexScope analysis shape.
 * Returns { analysis, issues } — `issues` lists what had to be repaired.
 */
export function normalizeAnalysis(raw) {
  const issues = []
  const src = raw && typeof raw === 'object' ? raw : {}

  let overall_risk = normalizeRisk(src.overall_risk ?? src.overallRisk, 'medium')
  const summary = asString(src.summary)
  if (!summary) issues.push('summary was missing')

  const clauses = (Array.isArray(src.clauses) ? src.clauses : [])
    .slice(0, 40)
    .map(normalizeClause)
    .filter((c) => c.original_text || c.plain_language)
  if (!Array.isArray(src.clauses)) issues.push('clauses array was missing')

  const red_flags = (Array.isArray(src.red_flags) ? src.red_flags : [])
    .slice(0, 20)
    .map(normalizeRedFlag)
    .filter((f) => f.title || f.explanation)
  if (!Array.isArray(src.red_flags) && (src.red_flags == null || src.red_flags !== '')) {
    issues.push('red_flags was missing or malformed')
  }

  const important_dates = (Array.isArray(src.important_dates) ? src.important_dates : [])
    .slice(0, 15)
    .map(normalizeDate)
    .filter((d) => d && (d.date || d.description))

  const analysis = {
    summary,
    document_type: asString(src.document_type || src.documentType, 'Unrecognised document type') || 'Unrecognised document type',
    overall_risk,
    key_takeaways: asStringArray(src.key_takeaways ?? src.keyTakeaways, 10),
    clauses,
    red_flags,
    obligations: asStringArray(src.obligations, 15),
    important_dates,
    questions_to_ask: asStringArray(src.questions_to_ask ?? src.questionsToAsk, 12),
  }
  return { analysis, issues }
}

/** Aggregated counts used by the Risk Overview panel. */
export function riskCounts(analysis) {
  const counts = { high: 0, medium: 0, low: 0 }
  for (const clause of analysis?.clauses || []) counts[clause.risk_level] += 1
  const flagCounts = { high: 0, medium: 0, low: 0 }
  for (const flag of analysis?.red_flags || []) flagCounts[flag.severity] += 1
  return { clauses: counts, redFlags: flagCounts }
}
